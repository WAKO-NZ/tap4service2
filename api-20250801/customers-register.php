<?php
/**
 * customers-register.php - Version V1.2
 * - Updated to use Composer autoloader for PHPMailer.
 * - Added email verification: generates token, stores user as 'pending', sends verification email using PHPMailer.
 * - On success, returns message to verify email; no immediate login.
 * - Handles duplicate email with 409 status.
 * - Logs errors to /home/tapservi/public_html/api/logs/custom_errors.log.
 * - Inserts customer data into both `customers` and `customer_details` tables.
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
$result = $conn->query("DESCRIBE customers");
$customerColumns = [];
while ($row = $result->fetch_assoc()) {
    $customerColumns[] = $row['Field'];
}
$requiredCustomerColumns = ['email', 'password', 'name', 'region', 'status', 'verification_token'];
$missingCustomerColumns = array_diff($requiredCustomerColumns, $customerColumns);
if (!empty($missingCustomerColumns)) {
    error_log("Missing required columns in customers table: " . implode(', ', $missingCustomerColumns));
    http_response_code(500);
    echo json_encode(['error' => "Database schema error: Missing required columns " . implode(', ', $missingCustomerColumns)]);
    exit;
}

$result = $conn->query("DESCRIBE customer_details");
$customerDetailsColumns = [];
while ($row = $result->fetch_assoc()) {
    $customerDetailsColumns[] = $row['Field'];
}
$requiredDetailsColumns = ['customer_id'];
$missingDetailsColumns = array_diff($requiredDetailsColumns, $customerDetailsColumns);
if (!empty($missingDetailsColumns)) {
    error_log("Missing required columns in customer_details table: " . implode(', ', $missingDetailsColumns));
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
            $stmt = $conn->prepare("SELECT id FROM customers WHERE email = ?");
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
        $alternate_phone_number = $data['alternate_phone_number'] ?? null;
        $city = $data['city'] ?? null;
        $postal_code = $data['postal_code'] ?? null;
        $region = $data['region'] ?? '';

        if (empty($email) || empty($password) || empty($name) || empty($region)) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }

        // Check if email exists (redundant check for full registration)
        $stmt = $conn->prepare("SELECT id FROM customers WHERE email = ?");
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

        // Insert into customers table
        $stmt = $conn->prepare("INSERT INTO customers (email, password, name, region, status, verification_token) VALUES (?, ?, ?, ?, 'pending', ?)");
        $hashed_password = password_hash($password, PASSWORD_DEFAULT);
        $stmt->bind_param('sssss', $email, $hashed_password, $name, $region, $verification_token);
        if (!$stmt->execute()) {
            error_log("Execute failed for customers insert: " . $stmt->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database error']);
            exit;
        }
        $customerId = $conn->insert_id;
        $stmt->close();

        // Insert into customer_details table
        $detailsColumns = ['customer_id'];
        $detailsValues = ['?'];
        $detailsParams = [$customerId];
        $types = 'i'; // Start with integer for customer_id
        if ($address !== null && in_array('address', $customerDetailsColumns)) {
            $detailsColumns[] = 'address';
            $detailsValues[] = '?';
            $detailsParams[] = $address;
            $types .= 's';
        }
        if ($phone_number !== null && in_array('phone_number', $customerDetailsColumns)) {
            $detailsColumns[] = 'phone_number';
            $detailsValues[] = '?';
            $detailsParams[] = $phone_number;
            $types .= 's';
        }
        if ($alternate_phone_number !== null && in_array('alternate_phone_number', $customerDetailsColumns)) {
            $detailsColumns[] = 'alternate_phone_number';
            $detailsValues[] = '?';
            $detailsParams[] = $alternate_phone_number;
            $types .= 's';
        }
        if ($city !== null && in_array('city', $customerDetailsColumns)) {
            $detailsColumns[] = 'city';
            $detailsValues[] = '?';
            $detailsParams[] = $city;
            $types .= 's';
        }
        if ($postal_code !== null && in_array('postal_code', $customerDetailsColumns)) {
            $detailsColumns[] = 'postal_code';
            $detailsValues[] = '?';
            $detailsParams[] = $postal_code;
            $types .= 's';
        }

        $detailsQuery = "INSERT INTO customer_details (" . implode(', ', $detailsColumns) . ") VALUES (" . implode(', ', $detailsValues) . ")";
        $stmt = $conn->prepare($detailsQuery);
        if ($stmt === false) {
            error_log("Prepare failed for customer_details insert: " . $conn->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database prepare error']);
            exit;
        }

        $stmt->bind_param($types, ...$detailsParams);
        if (!$stmt->execute()) {
            error_log("Execute failed for customer_details insert: " . $stmt->error);
            // Cleanup customers entry if details insert fails
            $cleanupStmt = $conn->prepare("DELETE FROM customers WHERE id = ?");
            $cleanupStmt->bind_param('i', $customerId);
            $cleanupStmt->execute();
            $cleanupStmt->close();
            http_response_code(500);
            echo json_encode(['error' => 'Database error']);
            exit;
        }
        $stmt->close();

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
                <a href='https://tap4service.co.nz/api/verify.php?token={$verification_token}&email={$email}&type=customer' style='background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;'>Verify Email</a>
                <p>If the button doesn't work, copy and paste this link into your browser:</p>
                <p>https://tap4service.co.nz/api/verify.php?token={$verification_token}&email={$email}&type=customer</p>
              </body>
              </html>
            ";
            $mail->AltBody = "Thank you for registering with Tap4Service! Please verify your email by visiting: https://tap4service.co.nz/api/verify.php?token={$verification_token}&email={$email}&type=customer";

            $mail->send();
            echo json_encode(['message' => 'Verification email sent. Please check your inbox to complete registration.', 'customerId' => $customerId]);
        } catch (Exception $e) {
            error_log("Mailer Error: " . $mail->ErrorInfo);
            // Cleanup both tables if email fails
            $stmt = $conn->prepare("DELETE FROM customers WHERE id = ?");
            $stmt->bind_param('i', $customerId);
            $stmt->execute();
            $stmt->close();
            $stmt = $conn->prepare("DELETE FROM customer_details WHERE customer_id = ?");
            $stmt->bind_param('i', $customerId);
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