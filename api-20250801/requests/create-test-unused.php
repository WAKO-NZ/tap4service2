<?php
/**
 * create.php - Version V1.3
 * - Handles POST requests to create a new service request.
 * - Inserts data into the service_requests table with customer address and system types.
 * - Validates and sanitizes inputs.
 * - Logs errors to /home/tapservi/public_html/api/logs/custom_errors.log.
 * - Updated to accept and store system_types as a JSON string.
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

$rawInput = file_get_contents('php://input');
error_log("Raw input received: " . $rawInput);
$data = json_decode($rawInput, true);
if (json_last_error() !== JSON_ERROR_NONE && $rawInput) {
    error_log("JSON decode error: " . json_last_error_msg() . ", Raw input: " . $rawInput);
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON payload']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $customer_id = $data['customer_id'] ?? null;
        $repair_description = $data['repair_description'] ?? '';
        $availability_1 = $data['availability_1'] ?? null;
        $availability_2 = $data['availability_2'] ?? null;
        $region = $data['region'] ?? '';
        $customer_address = $data['customer_address'] ?? null;
        $customer_city = $data['customer_city'] ?? null;
        $customer_postal_code = $data['customer_postal_code'] ?? null;
        $system_types = $data['system_types'] ?? []; // New field, array of selected types

        error_log("Processing request: " . json_encode($data)); // Debug log

        if (!$customer_id || empty($repair_description) || empty($availability_1) || empty($region)) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }

        // Sanitize inputs
        $repair_description = filter_var($repair_description, FILTER_SANITIZE_STRING);
        $region = filter_var($region, FILTER_SANITIZE_STRING);
        if ($customer_address !== null) $customer_address = filter_var($customer_address, FILTER_SANITIZE_STRING);
        if ($customer_city !== null) $customer_city = filter_var($customer_city, FILTER_SANITIZE_STRING);
        if ($customer_postal_code !== null) $customer_postal_code = preg_replace('/[^0-9A-Za-z]/', '', $customer_postal_code);
        $system_types_json = json_encode($system_types); // Convert array to JSON string for storage

        // Validate datetime format
        $dateFormat = 'Y-m-d H:i:s';
        $d1 = DateTime::createFromFormat($dateFormat, $availability_1);
        $d2 = $availability_2 ? DateTime::createFromFormat($dateFormat, $availability_2) : null;
        if (!$d1 || ($availability_2 && !$d2)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid date format for availability']);
            exit;
        }

        $stmt = $conn->prepare("INSERT INTO service_requests (customer_id, repair_description, customer_availability_1, customer_availability_2, region, customer_address, customer_city, customer_postal_code, system_types, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())");
        $stmt->bind_param('issssssss', $customer_id, $repair_description, $availability_1, $availability_2, $region, $customer_address, $customer_city, $customer_postal_code, $system_types_json);
        if (!$stmt->execute()) {
            error_log("Insert failed: " . $stmt->error . ", Data: " . json_encode($data));
            http_response_code(500);
            echo json_encode(['error' => 'Failed to create request']);
            exit;
        }
        $stmt->close();

        error_log("Request created successfully for customer_id: $customer_id");
        echo json_encode(['message' => 'Request submitted successfully']);
    } catch (Exception $e) {
        error_log("Error in create.php: " . $e->getMessage() . ", Data: " . json_encode($data));
        http_response_code(500);
        echo json_encode(['error' => 'Server error']);
    }
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}

$conn->close();
?>