<?php
/**
 * technicians-register.php - Version V2.1
 * - Fixed SQL syntax error in technician_details INSERT by using positional placeholders.
 * - Updated to insert technician data into both `technicians` and `technician_details` tables.
 * - Added email verification: generates token, stores user as 'pending', sends verification email using PHPMailer.
 * - On success, returns message to verify email; no immediate login.
 * - Handles duplicate email with 409 status.
 * - Logs errors to /home/tapservi/public_html/api/logs/custom_errors.log.
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://tap4service.co.nz');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', '/home/tapservi/public_html/api/logs/custom_errors.log');

// Use Composer autoloader
require_once '/home/tapservi/public_html/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

$servername = "localhost";
$username = "tapservi_deploy";
$password = "WAKO123#";
$dbname = "tapservi_tap4service";

$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    error_log("Connection failed: " . $conn->connect_error);
    http_response_code(500);
    echo json_encode(['error' => 'Connection failed']);
    exit;
}

// Check table schema for required columns
$result = $conn->query("DESCRIBE technicians");
$technicianColumns = [];
while ($row = $result->fetch_assoc()) {
    $technicianColumns[] = $row['Field'];
}
$requiredTechnicianColumns = ['email', 'password', 'name', 'status', 'verification_token'];
$missingTechnicianColumns = array_diff($requiredTechnicianColumns, $technicianColumns);
if (!empty($missingTechnicianColumns)) {
    error_log("Missing required columns in technicians table: " . implode(', ', $missingTechnicianColumns));
    http_response_code(500);
    echo json_encode(['error' => "Database schema error: Missing required columns " . implode(', ', $missingTechnicianColumns)]);
    exit;
}

$result = $conn->query("DESCRIBE technician_details");
$technicianDetailsColumns = [];
while ($row = $result->fetch_assoc()) {
    $technicianDetailsColumns[] = $row['Field'];
}
$requiredDetailsColumns = ['technician_id'];
$missingDetailsColumns = array_diff($requiredDetailsColumns, $technicianDetailsColumns);
if (!empty($missingDetailsColumns)) {
    error_log("Missing required columns in technician_details table: " . implode(', ', $missingDetailsColumns));
    http_response_code(500);
    echo json_encode(['error' => "Database schema error: Missing required columns " . implode(', ', $missingDetailsColumns)]);
    exit;
}

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);
if (json_last_error() !== JSON_ERROR_NONE && $rawInput) {
    error_log("JSON decode error: " . json_last_error_msg());
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON payload']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $email = $data['email'] ?? '';
        $checkOnly = isset($data['checkOnly']) && $data['checkOnly'];
        if ($checkOnly) {
            $stmt = $conn->prepare("SELECT id FROM technicians WHERE email = ?");
            $stmt->bind_param('s', $email);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($result->num_rows > 0) {
                http_response_code(409);
                echo json_encode(['error' => 'Email already exists']);
            } else {
                echo json_encode(['message' => 'Email available']);
            }
            $stmt->close();
            exit;
        }

        $password = $data['password'] ?? '';
        $name = $data['name'] ?? '';
        $address = $data['address'] ?? null;
        $phone_number = $data['phone_number'] ?? null;
        $pspla_number = $data['pspla_number'] ?? null;
        $nzbn_number = $data['nzbn_number'] ?? null;
        $public_liability_insurance = isset($data['public_liability_insurance']) ? filter_var($data['public_liability_insurance'], FILTER_VALIDATE_BOOLEAN) : null;
        $city = $data['city'] ?? null;
        $postal_code = $data['postal_code'] ?? null;
        $service_regions = $data['service_regions'] ?? [];

        if (empty($email) || empty($password) || empty($name) || empty($pspla_number) || $public_liability_insurance === null || empty($service_regions)) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }

        // Check if email exists (redundant check for full registration)
        $stmt = $conn->prepare("SELECT id FROM technicians WHERE email = ?");
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $result = $stmt->get_result();
        if ($result->num_rows > 0) {
            http_response_code(409);
            echo json_encode(['error' => 'Email already exists']);
            exit;
        }
        $stmt->close();

        // Generate verification token
        $verification_token = md5(uniqid(rand(), true));

        // Insert into technicians table
        $stmt = $conn->prepare("INSERT INTO technicians (email, password, name, status, verification_token) VALUES (?, ?, ?, 'pending', ?)");
        $hashed_password = password_hash($password, PASSWORD_DEFAULT);
        $stmt->bind_param('ssss', $email, $hashed_password, $name, $verification_token);
        if (!$stmt->execute()) {
            error_log("Execute failed for technicians insert: " . $stmt->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database error']);
            exit;
        }
        $technicianId = $conn->insert_id;
        $stmt->close();

        // Insert into technician_details table
        $detailsColumns = ['technician_id'];
        $detailsValues = ['?'];
        $detailsParams = [$technicianId];
        $types = 'i'; // Start with integer for technician_id
        if ($phone_number !== null && in_array('phone_number', $technicianDetailsColumns)) {
            $detailsColumns[] = 'phone_number';
            $detailsValues[] = '?';
            $detailsParams[] = $phone_number;
            $types .= 's';
        }
        if ($address !== null && in_array('address', $technicianDetailsColumns)) {
            $detailsColumns[] = 'address';
            $detailsValues[] = '?';
            $detailsParams[] = $address;
            $types .= 's';
        }
        if ($city !== null && in_array('city', $technicianDetailsColumns)) {
            $detailsColumns[] = 'city';
            $detailsValues[] = '?';
            $detailsParams[] = $city;
            $types .= 's';
        }
        if ($postal_code !== null && in_array('postal_code', $technicianDetailsColumns)) {
            $detailsColumns[] = 'postal_code';
            $detailsValues[] = '?';
            $detailsParams[] = $postal_code;
            $types .= 's';
        }
        if ($pspla_number !== null && in_array('pspla_number', $technicianDetailsColumns)) {
            $detailsColumns[] = 'pspla_number';
            $detailsValues[] = '?';
            $detailsParams[] = $pspla_number;
            $types .= 's';
        }
        if ($nzbn_number !== null && in_array('nzbn_number', $technicianDetailsColumns)) {
            $detailsColumns[] = 'nzbn_number';
            $detailsValues[] = '?';
            $detailsParams[] = $nzbn_number;
            $types .= 's';
        }
        if ($public_liability_insurance !== null && in_array('public_liability_insurance', $technicianDetailsColumns)) {
            $detailsColumns[] = 'public_liability_insurance';
            $detailsValues[] = '?';
            $detailsParams[] = $public_liability_insurance;
            $types .= 'i'; // Integer for boolean (0 or 1)
        }

        $detailsQuery = "INSERT INTO technician_details (" . implode(', ', $detailsColumns) . ") VALUES (" . implode(', ', $detailsValues) . ")";
        $stmt = $conn->prepare($detailsQuery);
        if ($stmt === false) {
            error_log("Prepare failed for technician_details insert: " . $conn->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database prepare error']);
            exit;
        }

        $stmt->bind_param($types, ...$detailsParams);
        if (!$stmt->execute()) {
            error_log("Execute failed for technician_details insert: " . $stmt->error);
            // Cleanup technicians entry if details insert fails
            $cleanupStmt = $conn->prepare("DELETE FROM technicians WHERE id = ?");
            $cleanupStmt->bind_param('i', $technicianId);
            $cleanupStmt->execute();
            $cleanupStmt->close();
            http_response_code(500);
            echo json_encode(['error' => 'Database error']);
            exit;
        }
        $stmt->close();

        // Insert service regions
        foreach ($service_regions as $region) {
            $column = strtolower(str_replace(['-', ' ', '’'], '_', $region));
            if ($column) {
                $stmt = $conn->prepare("INSERT INTO technician_service_regions (technician_id, $column) VALUES (?, 1)");
                $stmt->bind_param('i', $technicianId);
                $stmt->execute();
                $stmt->close();
            }
        }

        // Send verification email
        $mail = new PHPMailer(true);
        try {
            $mail->isSMTP();
            $mail->Host = 'mail.tap4service.co.nz';
            $mail->SMTPAuth = true;
            $mail->Username = 'register@tap4service.co.nz';
            $mail->Password = 'e6GeNNNgr73aF3W';
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
            $mail->Port = 465;

            $mail->setFrom('register@tap4service.co.nz', 'Tap4Service Registration');
            $mail->addAddress($email, $name);

            $mail->isHTML(true);
            $mail->Subject = 'Verify Your Tap4Service Registration';
            $mail->Body = "
              <html>
              <body>
                <p>Thank you for registering with Tap4Service!</p>
                <p>Please click the button below to verify your email and complete registration:</p>
                <a href='https://tap4service.co.nz/api/verify.php?token={$verification_token}&email={$email}&type=technician' style='background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;'>Verify Email</a>
                <p>If the button doesn't work, copy and paste this link into your browser:</p>
                <p>https://tap4service.co.nz/api/verify.php?token={$verification_token}&email={$email}&type=technician</p>
              </body>
              </html>
            ";
            $mail->AltBody = "Thank you for registering with Tap4Service! Please verify your email by visiting: https://tap4service.co.nz/api/verify.php?token={$verification_token}&email={$email}&type=technician";

            $mail->send();
            echo json_encode(['message' => 'Verification email sent. Please check your inbox to complete registration.', 'technicianId' => $technicianId]);
        } catch (Exception $e) {
            error_log("Mailer Error: " . $mail->ErrorInfo);
            // Cleanup both tables if email fails
            $stmt = $conn->prepare("DELETE FROM technicians WHERE id = ?");
            $stmt->bind_param('i', $technicianId);
            $stmt->execute();
            $stmt->close();
            $stmt = $conn->prepare("DELETE FROM technician_details WHERE technician_id = ?");
            $stmt->bind_param('i', $technicianId);
            $stmt->execute();
            $stmt->close();
            $stmt = $conn->prepare("DELETE FROM technician_service_regions WHERE technician_id = ?");
            $stmt->bind_param('i', $technicianId);
            $stmt->execute();
            $stmt->close();
            http_response_code(500);
            echo json_encode(['error' => 'Failed to send verification email']);
        }
    } catch (Exception $e) {
        error_log("Error in POST: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Server error']);
    }
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}

$conn->close();
?>