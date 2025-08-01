<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://tap4service.co.nz');
header('Access-Control-Allow-Methods: PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', '/home/tapservi/public_html/php_errors.log');

$servername = "localhost";
$username = "tapservi_deploy";
$password = "WAKO123#";
$dbname = "tapservi_tap4service";

$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    error_log("Database connection failed: " . $conn->connect_error);
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

$rawInput = file_get_contents('php://input');
error_log("Raw input for assign: " . $rawInput);
$data = json_decode($rawInput, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    error_log("JSON decode error: " . json_last_error_msg());
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON payload']);
    exit;
}

$technicianId = $data['technicianId'] ?? '';
$scheduledTime = $data['scheduledTime'] ?? '';
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$segments = explode('/', trim($uri, '/'));
$requestId = end($segments);

if (empty($technicianId) || empty($scheduledTime) || empty($requestId) || !is_numeric($requestId)) {
    error_log("Missing required fields: technicianId=$technicianId, scheduledTime=$scheduledTime, requestId=$requestId");
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields']);
    exit;
}

$stmt = $conn->prepare("UPDATE service_requests SET technician_id = ?, technician_scheduled_time = ?, status = 'assigned' WHERE id = ?");
$stmt->bind_param("isi", $technicianId, $scheduledTime, $requestId);
if ($stmt->execute()) {
    error_log("Job assigned successfully for requestId: $requestId, technicianId: $technicianId");
    http_response_code(200);
    echo json_encode(['message' => 'Job assigned successfully']);
} else {
    error_log("Failed to assign job: " . $conn->error);
    http_response_code(400);
    echo json_encode(['error' => 'Failed to assign job']);
}

$stmt->close();
$conn->close();
?>