<?php
/**
 * technicians-login.php - Version V1.3
 * - Handles technician login via POST /api/technicians-login.php.
 * - Validates email and password against technicians table.
 * - Sets session variables user_id, role, and user_name for authentication.
 * - Updates login_status to 'online' in technicians table.
 * - Fixed database credentials and session handling to resolve 500 error and empty session.
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

    $rawInput = file_get_contents('php://input');
    error_log("Raw input received: " . $rawInput);
    $data = json_decode($rawInput, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log("JSON decode error: " . json_last_error_msg());
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON payload: ' . json_last_error_msg()]);
        exit;
    }
    error_log("Parsed login data: " . json_encode($data));

    $email = trim($data['email'] ?? '');
    $password = trim($data['password'] ?? '');

    if (empty($email) || empty($password)) {
        error_log("Missing email or password: email=$email");
        http_response_code(400);
        echo json_encode(['error' => 'Email and password are required']);
        exit;
    }

    $email = filter_var($email, FILTER_SANITIZE_EMAIL);
    error_log("Querying technicians with email: $email");

    $stmt = $conn->prepare("SELECT id, email, name, password, status FROM technicians WHERE email = ?");
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

    if ($user && password_verify($password, $user['password'])) {
        if ($user['status'] === 'pending') {
            error_log("Login denied: Account pending for email: $email");
            http_response_code(403);
            echo json_encode(['error' => 'Account is pending verification. Please check your email.']);
            exit;
        }

        $conn->begin_transaction();
        try {
            $stmt = $conn->prepare("UPDATE technicians SET login_status = 'online' WHERE id = ?");
            if (!$stmt) {
                error_log("Prepare failed for login_status update: " . $conn->error);
                throw new Exception("Database query preparation failed: " . $conn->error);
            }
            $stmt->bind_param('i', $user['id']);
            if (!$stmt->execute()) {
                error_log("Execute failed for login_status update: " . $stmt->error);
                throw new Exception("Database query execution failed: " . $stmt->error);
            }
            $stmt->close();

            $conn->commit();
            error_log("Login status updated to 'online' for technician ID: " . $user['id']);
        } catch (Exception $e) {
            $conn->rollback();
            error_log("Transaction failed for login_status update: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'Failed to update login status: ' . $e->getMessage()]);
            exit;
        }

        session_regenerate_id(true);
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['role'] = 'technician';
        $_SESSION['user_name'] = $user['name'];
        error_log("Login successful for technician ID: " . $user['id']);
        error_log("Session data: " . json_encode($_SESSION));

        http_response_code(200);
        echo json_encode([
            'message' => 'Login successful',
            'userId' => $user['id'],
            'role' => 'technician',
            'userName' => $user['name']
        ]);
    } else {
        error_log("Invalid email or password for email: $email");
        http_response_code(401);
        echo json_encode(['error' => 'Invalid email or password']);
        exit;
    }
} catch (Exception $e) {
    error_log("Exception in technicians-login.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
} finally {
    if (isset($conn) && $conn instanceof mysqli && $conn->ping()) {
        $conn->close();
    }
}
?>