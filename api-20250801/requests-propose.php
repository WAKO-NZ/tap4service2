<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://tap4service.co.nz');
header('Access-Control-Allow-Methods: POST, OPTIONS');
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
error_log("Raw input for propose: " . $rawInput);
$data = json_decode($rawInput, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    error_log("JSON decode error: " . json_last_error_msg());
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON payload']);
    exit;
}

$technicianId = $data['technicianId'] ?? '';
$proposedTime = $data['proposedTime'] ?? '';
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$segments = explode('/', trim($uri, '/'));
$requestId = end($segments);

if (empty($technicianId) || empty($proposedTime) || empty($requestId) || !is_numeric($requestId)) {
    error_log("Missing required fields: technicianId=$technicianId, proposedTime=$proposedTime, requestId=$requestId");
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields']);
    exit;
}

$stmt = $conn->prepare("INSERT INTO pending_proposals (request_id, technician_id, proposed_time, proposal_status) VALUES (?, ?, ?, 'pending')");
$stmt->bind_param("iis", $requestId, $technicianId, $proposedTime);
if ($stmt->execute()) {
    error_log("Alternative time proposed for requestId: $requestId, technicianId: $technicianId");
    http_response_code(200);
    echo json_encode(['message' => 'Alternative time proposed']);
} else {
    error_log("Failed to propose time: " . $conn->error);
    http_response_code(400);
    echo json_encode(['error' => 'Failed to propose time']);
}

$stmt->close();
$conn->close();
?>