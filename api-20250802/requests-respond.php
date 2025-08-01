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
error_log("Raw input for respond: " . $rawInput);
$data = json_decode($rawInput, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    error_log("JSON decode error: " . json_last_error_msg());
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON payload']);
    exit;
}

$technicianId = $data['technicianId'] ?? '';
$action = $data['action'] ?? '';
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$segments = explode('/', trim($uri, '/'));
$requestId = end($segments);

if (empty($technicianId) || empty($action) || empty($requestId) || !is_numeric($requestId) || !in_array($action, ['accept', 'decline'])) {
    error_log("Missing or invalid fields: technicianId=$technicianId, action=$action, requestId=$requestId");
    http_response_code(400);
    echo json_encode(['error' => 'Missing or invalid fields']);
    exit;
}

if ($action === 'accept') {
    $stmt = $conn->prepare("UPDATE service_requests SET technician_id = ?, status = 'assigned' WHERE id = ? AND technician_id IS NULL");
    $stmt->bind_param("ii", $technicianId, $requestId);
} else {
    $stmt = $conn->prepare("UPDATE service_requests SET technician_id = NULL, status = 'pending' WHERE id = ? AND technician_id = ?");
    $stmt->bind_param("ii", $requestId, $technicianId);
}

if ($stmt->execute()) {
    error_log("Request $action successful for requestId: $requestId, technicianId: $technicianId");
    http_response_code(200);
    echo json_encode(['message' => ucfirst($action) . ' successful']);
} else {
    error_log("Failed to $action request: " . $conn->error);
    http_response_code(400);
    echo json_encode(['error' => 'Failed to ' . $action . ' request']);
}

$stmt->close();
$conn->close();
?>