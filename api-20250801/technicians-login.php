<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://tap4service.co.nz');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', '/home/tapservi/public_html/php_errors.log');

try {
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
    error_log("Database connection successful");

    $rawInput = file_get_contents('php://input');
    error_log("Login attempt with input: " . $rawInput);
    $data = json_decode($rawInput, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log("JSON decode error: " . json_last_error_msg());
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON payload']);
        exit;
    }

    $email = trim($data['email'] ?? '');
    $password = trim($data['password'] ?? '');

    if (empty($email) || empty($password)) {
        error_log("Missing email or password: email=$email");
        http_response_code(400);
        echo json_encode(['error' => 'Missing email or password']);
        exit;
    }

    $stmt = $conn->prepare("SELECT id, email, name, password, status FROM technicians WHERE email = ?");
    if (!$stmt) {
        error_log("Prepare failed: " . $conn->error);
        http_response_code(500);
        echo json_encode(['error' => 'Database query preparation failed']);
        exit;
    }
    $stmt->bind_param('s', $email);
    if (!$stmt->execute()) {
        error_log("Execute failed: " . $stmt->error);
        http_response_code(500);
        echo json_encode(['error' => 'Database query execution failed']);
        exit;
    }
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    $stmt->close();

    if ($user && password_verify($password, $user['password'])) {
        if ($user['status'] === 'pending') {
            error_log("Login denied: Account pending for email: $email");
            http_response_code(403);
            echo json_encode(['error' => 'Account is pending verification. Please check your email.']);
        } else {
            error_log("Login successful for email: $email, userId: {$user['id']}");
            http_response_code(200);
            echo json_encode([
                'valid' => true,
                'userId' => $user['id'],
                'email' => $user['email'],
                'name' => $user['name']
            ]);
        }
    } else {
        error_log("Invalid email or password for email: $email");
        http_response_code(401);
        echo json_encode(['error' => 'Invalid email or password']);
    }

    $conn->close();
} catch (Exception $e) {
    error_log("Exception in technicians-login.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Server error']);
    exit;
}
?>