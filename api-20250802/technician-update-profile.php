<?php
/**
 * technician-update-profile.php - Version V1.0
 * - Handles updating technician profile data via POST /api/technician-update-profile.php.
 * - Validates session to prevent unauthorized access.
 * - Uses correct database credentials to avoid 500 errors.
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://tap4service.co.nz');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
header('Access-Control-Allow-Credentials: true');

ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', '/home/tapservi/public_html/api/logs/custom_errors.log');

session_start();
error_log("Session start: " . json_encode($_SESSION));

try {
    $servername = "localhost";
    $username = "tapservi_deploy";
    $password = "WAKO123#";
    $dbname = "tapservi_tap4service";

    error_log("Attempting database connection: server=$servername, user=$username, db=$dbname");
    $conn = new mysqli($servername, $username, $password, $dbname);
    if ($conn->connect_error) {
        error_log("Database connection failed: " . $conn->connect_error);
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed: ' . $conn->connect_error]);
        exit;
    }
    error_log("Database connection successful");

    $method = $_SERVER['REQUEST_METHOD'];
    $rawInput = file_get_contents('php://input');
    error_log("Raw input received: " . $rawInput);
    $data = !empty($rawInput) ? json_decode($rawInput, true) : null;
    if ($rawInput && json_last_error() !== JSON_ERROR_NONE) {
        error_log("JSON decode error: " . json_last_error_msg());
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON payload']);
        exit;
    }
    error_log("Request details: method=$method, data=" . json_encode($data));

    if ($method === 'OPTIONS') {
        http_response_code(200);
        exit;
    }

    if (!isset($_SESSION['user_id']) || !isset($_SESSION['role']) || $_SESSION['role'] !== 'technician') {
        error_log("Unauthorized access attempt: session=" . json_encode($_SESSION));
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    $technician_id = $_SESSION['user_id'];

    if ($method === 'POST') {
        if (!isset($data['name']) || !isset($data['email'])) {
            error_log("Missing required fields: " . json_encode($data));
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }

        $name = trim($data['name']);
        $address = isset($data['address']) ? trim($data['address']) : null;
        $phone_number = isset($data['phone_number']) ? trim($data['phone_number']) : null;
        $city = isset($data['city']) ? trim($data['city']) : null;
        $postal_code = isset($data['postal_code']) ? trim($data['postal_code']) : null;
        $pspla_number = isset($data['pspla_number']) ? trim($data['pspla_number']) : null;
        $nzbn_number = isset($data['nzbn_number']) ? trim($data['nzbn_number']) : null;
        $public_liability_insurance = isset($data['public_liability_insurance']) ? (bool)$data['public_liability_insurance'] : false;
        $password = isset($data['password']) && !empty($data['password']) ? password_hash(trim($data['password']), PASSWORD_BCRYPT) : null;

        if (strlen($name) > 255 || ($address && strlen($address) > 255) || ($phone_number && strlen($phone_number) > 20) || ($city && strlen($city) > 255) || ($postal_code && strlen($postal_code) > 10) || ($pspla_number && strlen($pspla_number) > 50) || ($nzbn_number && strlen($nzbn_number) > 50)) {
            error_log("Invalid field lengths");
            http_response_code(400);
            echo json_encode(['error' => 'Field lengths exceed limits']);
            exit;
        }

        $conn->begin_transaction();
        try {
            $query = "UPDATE technicians SET name = ?";
            $params = [$name];
            $types = 's';
            if ($password) {
                $query .= ", password = ?";
                $params[] = $password;
                $types .= 's';
            }
            $query .= " WHERE id = ?";
            $params[] = $technician_id;
            $types .= 'i';

            $stmt = $conn->prepare($query);
            if (!$stmt) {
                error_log("Prepare failed for technicians update: " . $conn->error);
                throw new Exception("Database query preparation failed: " . $conn->error);
            }
            $stmt->bind_param($types, ...$params);
            if (!$stmt->execute()) {
                error_log("Execute failed for technicians update: " . $stmt->error);
                throw new Exception("Database query execution failed: " . $stmt->error);
            }
            $stmt->close();

            $stmt = $conn->prepare("INSERT INTO technician_details (technician_id, address, phone_number, city, postal_code, pspla_number, nzbn_number, public_liability_insurance) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE address = ?, phone_number = ?, city = ?, postal_code = ?, pspla_number = ?, nzbn_number = ?, public_liability_insurance = ?");
            if (!$stmt) {
                error_log("Prepare failed for technician_details update: " . $conn->error);
                throw new Exception("Database query preparation failed: " . $conn->error);
            }
            $stmt->bind_param('issssssissssssi', $technician_id, $address, $phone_number, $city, $postal_code, $pspla_number, $nzbn_number, $public_liability_insurance, $address, $phone_number, $city, $postal_code, $pspla_number, $nzbn_number, $public_liability_insurance);
            if (!$stmt->execute()) {
                error_log("Execute failed for technician_details update: " . $stmt->error);
                throw new Exception("Database query execution failed: " . $stmt->error);
            }
            $stmt->close();

            $conn->commit();
            error_log("Profile updated successfully for technician ID: $technician_id");
            http_response_code(200);
            echo json_encode(['message' => 'Profile updated successfully']);
        } catch (Exception $e) {
            $conn->rollback();
            error_log("Transaction failed: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'Failed to update profile: ' . $e->getMessage()]);
            exit;
        }
    } else {
        error_log("Invalid request: method=$method");
        http_response_code(400);
        echo json_encode(['error' => 'Invalid request']);
        exit;
    }
} catch (Exception $e) {
    error_log("Exception in technician-update-profile.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
} finally {
    if (isset($conn) && $conn instanceof mysqli && $conn->ping()) {
        $conn->close();
    }
}
?>