<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://tap4service.co.nz');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 1);
$logPath = '/home/tapservi/logs/php_errors.log';
if (!is_writable(dirname($logPath)) && function_exists('error_log')) {
    error_log('Custom log path not writable, using default.');
    ini_set('log_errors', 0);
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

// Read raw input
$rawInput = file_get_contents('php://input');
error_log("Raw input received: " . $rawInput);
$data = json_decode($rawInput, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    error_log("JSON decode error: " . json_last_error_msg());
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON payload']);
    exit;
}

error_log("Parsed login data: " . json_encode($data));
$email = isset($data['email']) ? trim($data['email']) : '';
$password = isset($data['password']) ? trim($data['password']) : '';

if (empty($email) || empty($password)) {
    error_log("Missing required fields: email=$email, password=" . (empty($password) ? 'empty' : 'provided'));
    http_response_code(400);
    echo json_encode(['error' => 'Email and password are required']);
    exit;
}

$email = filter_var($email, FILTER_SANITIZE_EMAIL);
error_log("Querying customers with email: $email");
$stmt = $conn->prepare("SELECT id, name, password, status FROM customers WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();

if ($user && password_verify($password, $user['password'])) {
    if ($user['status'] === 'pending') {
        error_log("Login denied: Account pending for email: $email");
        http_response_code(403);
        echo json_encode(['error' => 'Account is pending verification. Please check your email.']);
    } else {
        error_log("Login successful for user ID: " . $user['id']);
        http_response_code(200);
        echo json_encode(['userId' => $user['id'], 'name' => $user['name']]);
    }
} else {
    error_log("Login failed: Invalid credentials for email=$email");
    http_response_code(401);
    echo json_encode(['error' => 'Invalid credentials']);
}
$stmt->close();
$conn->close();
?>