<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://tap4service.co.nz');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
ini_set('log_errors', 1);
$logPath = '/home/tapservi/public_html/php_errors.log';
if (!is_writable(dirname($logPath)) && function_exists('error_log')) {
    error_log('Custom log path not writable, using default.');
    ini_set('error_log', '/tmp/php_errors.log');
} else {
    ini_set('error_log', $logPath);
}

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

$userId = $_GET['userId'] ?? '';
$role = $_GET['role'] ?? '';
error_log("Validating session for userId: $userId, role: $role");

if (empty($userId) || empty($role)) {
    http_response_code(400);
    echo json_encode(['error' => 'User ID and role are required']);
    exit;
}

$table = $role === 'technician' ? 'technicians' : 'customers';
$stmt = $conn->prepare("SELECT id FROM $table WHERE id = ?");
$stmt->bind_param("i", $userId);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();

if ($user) {
    error_log("Session validated successfully for userId: $userId");
    http_response_code(200);
    echo json_encode(['valid' => true, 'userId' => $user['id']]);
} else {
    error_log("Session validation failed for userId: $userId");
    http_response_code(401);
    echo json_encode(['error' => 'Invalid session']);
}

$stmt->close();
$conn->close();
?>