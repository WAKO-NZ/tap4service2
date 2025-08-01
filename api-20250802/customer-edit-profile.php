<?php
/**
 * customer-edit-profile.php - Version V1.4
 * - Handles fetching and updating customer profile data via /api/customer-edit-profile.php.
 * - Supports POST for both fetching and updating to comply with MyHost restrictions.
 * - Validates session to prevent unauthorized access.
 * - Fixed database credentials to resolve 500 errors.
 * - Made surname, alternate_phone_number, suburb, and region optional to fix 400 errors.
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

    if (!isset($_SESSION['user_id']) || !isset($_SESSION['role']) || $_SESSION['role'] !== 'customer') {
        error_log("Unauthorized access attempt: session=" . json_encode($_SESSION));
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    $user_id = $_SESSION['user_id'];

    if ($method === 'POST' && (!isset($data['action']) || $data['action'] === 'fetch')) {
        $stmt = $conn->prepare("SELECT c.id, c.email, c.name, c.surname, c.region, cd.address, cd.suburb, cd.phone_number, cd.alternate_phone_number, cd.city, cd.postal_code FROM customers c LEFT JOIN customer_details cd ON c.id = cd.customer_id WHERE c.id = ?");
        if (!$stmt) {
            error_log("Prepare failed: " . $conn->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database query preparation failed: ' . $conn->error]);
            exit;
        }
        $stmt->bind_param('i', $user_id);
        if (!$stmt->execute()) {
            error_log("Execute failed: " . $stmt->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database query execution failed: ' . $stmt->error]);
            exit;
        }
        $result = $stmt->get_result();
        $profile = $result->fetch_assoc();
        $stmt->close();

        if (!$profile) {
            error_log("No profile found for customer ID: $user_id");
            http_response_code(404);
            echo json_encode(['error' => 'Profile not found']);
            exit;
        }

        error_log("Profile fetched successfully for customer ID: $user_id");
        http_response_code(200);
        echo json_encode(['profile' => $profile]);
    } elseif ($method === 'POST' && isset($data['action']) && $data['action'] === 'update') {
        if (!isset($data['name']) || !isset($data['phone_number']) || !isset($data['address']) || !isset($data['city']) || !isset($data['postal_code'])) {
            error_log("Missing required fields: " . json_encode($data));
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }

        $name = trim($data['name']);
        $surname = isset($data['surname']) ? trim($data['surname']) : null;
        $region = isset($data['region']) ? trim($data['region']) : 'Auckland';
        $address = trim($data['address']);
        $suburb = isset($data['suburb']) ? trim($data['suburb']) : null;
        $phone_number = trim($data['phone_number']);
        $alternate_phone_number = isset($data['alternate_phone_number']) ? trim($data['alternate_phone_number']) : null;
        $city = trim($data['city']);
        $postal_code = trim($data['postal_code']);
        $password = isset($data['password']) && !empty($data['password']) ? password_hash(trim($data['password']), PASSWORD_BCRYPT) : null;

        if (strlen($name) > 255 || ($surname && strlen($surname) > 255) || strlen($region) > 255 || strlen($address) > 255 || ($suburb && strlen($suburb) > 100) || strlen($phone_number) > 50 || ($alternate_phone_number && strlen($alternate_phone_number) > 50) || strlen($city) > 100 || strlen($postal_code) > 20) {
            error_log("Invalid field lengths");
            http_response_code(400);
            echo json_encode(['error' => 'Field lengths exceed limits']);
            exit;
        }

        if (!in_array($region, ['Auckland', 'Bay of Plenty', 'Canterbury', 'Gisborne', 'Hawkes Bay', 'Manawatu-Whanganui', 'Marlborough', 'Nelson', 'Northland', 'Otago', 'Southland', 'Taranaki', 'Tasman', 'Waikato', 'Wellington', 'West Coast'])) {
            error_log("Invalid region: $region");
            http_response_code(400);
            echo json_encode(['error' => 'Invalid region']);
            exit;
        }

        $conn->begin_transaction();
        try {
            $query = "UPDATE customers SET name = ?, surname = ?, region = ?";
            $params = [$name, $surname, $region];
            $types = 'sss';
            if ($password) {
                $query .= ", password = ?";
                $params[] = $password;
                $types .= 's';
            }
            $query .= " WHERE id = ?";
            $params[] = $user_id;
            $types .= 'i';

            $stmt = $conn->prepare($query);
            if (!$stmt) {
                error_log("Prepare failed for customers update: " . $conn->error);
                throw new Exception("Database query preparation failed: " . $conn->error);
            }
            $stmt->bind_param($types, ...$params);
            if (!$stmt->execute()) {
                error_log("Execute failed for customers update: " . $stmt->error);
                throw new Exception("Database query execution failed: " . $stmt->error);
            }
            $stmt->close();

            $stmt = $conn->prepare("INSERT INTO customer_details (customer_id, address, suburb, phone_number, alternate_phone_number, city, postal_code) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE address = ?, suburb = ?, phone_number = ?, alternate_phone_number = ?, city = ?, postal_code = ?");
            if (!$stmt) {
                error_log("Prepare failed for customer_details update: " . $conn->error);
                throw new Exception("Database query preparation failed: " . $conn->error);
            }
            $stmt->bind_param('isssssssssss', $user_id, $address, $suburb, $phone_number, $alternate_phone_number, $city, $postal_code, $address, $suburb, $phone_number, $alternate_phone_number, $city, $postal_code);
            if (!$stmt->execute()) {
                error_log("Execute failed for customer_details update: " . $stmt->error);
                throw new Exception("Database query execution failed: " . $stmt->error);
            }
            $stmt->close();

            $conn->commit();
            error_log("Profile updated successfully for customer ID: $user_id");
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
        error_log("Invalid request: method=$method, action=" . (isset($data['action']) ? $data['action'] : 'none'));
        http_response_code(400);
        echo json_encode(['error' => 'Invalid request']);
        exit;
    }
} catch (Exception $e) {
    error_log("Exception in customer-edit-profile.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
} finally {
    if (isset($conn) && $conn instanceof mysqli && $conn->ping()) {
        $conn->close();
    }
}
?>