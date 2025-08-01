<?php
/**
 * customers-login.php - Version V1.9
 * - Handles customer login via POST /api/customers-login.php.
 * - Validates email and password, checks verification status.
 * - Sets session data and returns user details.
 * - Uses correct database credentials (tapservi_deploy, WAKO123#, tapservi_tap4service).
 * - Fixed querying technicians table; enhanced session handling.
 * - Returns 'Account not verified' if status is pending.
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
    error_log("Parsed login data: " . json_encode($data));

    if ($method === 'OPTIONS') {
        http_response_code(200);
        exit;
    }

    if ($method !== 'POST') {
        error_log("Invalid request method: $method");
        http_response_code(400);
        echo json_encode(['error' => 'Invalid request method']);
        exit;
    }

    if (!isset($data['email']) || !isset($data['password'])) {
        error_log("Missing email or password");
        http_response_code(400);
        echo json_encode(['error' => 'Email and password are required']);
        exit;
    }

    $email = trim($data['email']);
    $password = trim($data['password']);

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        error_log("Invalid email format: $email");
        http_response_code(400);
        echo json_encode(['error' => 'Invalid email format']);
        exit;
    }

    error_log("Querying customers with email: $email");
    $stmt = $conn->prepare("SELECT id, name, password, status FROM customers WHERE email = ?");
    if (!$stmt) {
        error_log("Prepare failed: " . $conn->error);
        http_response_code(500);
        echo json_encode(['error' => 'Database query preparation failed: ' . $conn->error]);
        exit;
    }
    $stmt->bind_param('s', $email);
    if (!$stmt->execute()) {
        error_log("Execute failed: " . $stmt->error);
        http_response_code(500);
        echo json_encode(['error' => 'Database query execution failed: ' . $stmt->error]);
        exit;
    }
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    $stmt->close();

    if (!$user) {
        error_log("Invalid email or password for email: $email");
        http_response_code(401);
        echo json_encode(['error' => 'Invalid email or password']);
        exit;
    }

    if ($user['status'] !== 'verified') {
        error_log("Login denied: Account not verified for email: $email");
        http_response_code(403);
        echo json_encode(['error' => 'Account not verified']);
        exit;
    }

    if (!password_verify($password, $user['password'])) {
        error_log("Invalid email or password for email: $email");
        http_response_code(401);
        echo json_encode(['error' => 'Invalid email or password']);
        exit;
    }

    $user_id = $user['id'];
    $_SESSION['user_id'] = $user_id;
    $_SESSION['role'] = 'customer';
    $_SESSION['user_name'] = $user['name'];

    $stmt = $conn->prepare("UPDATE customers SET login_status = 'online' WHERE id = ?");
    if (!$stmt) {
        error_log("Prepare failed for login_status update: " . $conn->error);
        http_response_code(500);
        echo json_encode(['error' => 'Database query preparation failed: ' . $conn->error]);
        exit;
    }
    $stmt->bind_param('i', $user_id);
    if (!$stmt->execute()) {
        error_log("Execute failed for login_status update: " . $stmt->error);
        http_response_code(500);
        echo json_encode(['error' => 'Database query execution failed: ' . $stmt->error]);
        exit;
    }
    error_log("Login status updated to 'online' for user ID: $user_id");
    $stmt->close();

    error_log("Login successful for user ID: $user_id");
    error_log("Session data: " . json_encode($_SESSION));
    http_response_code(200);
    echo json_encode([
        'message' => 'Login successful',
        'userId' => $user_id,
        'role' => 'customer',
        'userName' => $user['name']
    ]);
} catch (Exception $e) {
    error_log("Exception in customers-login.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
} finally {
    if (isset($conn) && $conn instanceof mysqli && $conn->ping()) {
        $conn->close();
    }
}
?>