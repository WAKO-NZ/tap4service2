<?php
/**
 * logout.php - Version V1.12
 * - Handles logout for customers and technicians via POST /api/logout.
 * - Clears session and sets login_status to 'offline' in customers or technicians table.
 * - Fixed database credentials and made connection optional to resolve 500 error.
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
error_log("Session before logout: " . json_encode($_SESSION));

try {
    $servername = "localhost";
    $username = "tapservi_deploy";
    $password = "WAKO123#";
    $dbname = "tapservi_tap4service";

    $conn = null;
    if (isset($_SESSION['user_id']) && isset($_SESSION['role'])) {
        error_log("Attempting database connection: server=$servername, user=$username, db=$dbname");
        $conn = new mysqli($servername, $username, $password, $dbname);
        if ($conn->connect_error) {
            error_log("Database connection failed: " . $conn->connect_error);
            // Proceed with logout even if DB connection fails
        } else {
            error_log("Database connection successful");
            $user_id = $_SESSION['user_id'];
            $role = $_SESSION['role'];
            $table = $role === 'customer' ? 'customers' : 'technicians';

            $stmt = $conn->prepare("UPDATE $table SET login_status = 'offline' WHERE id = ?");
            if (!$stmt) {
                error_log("Prepare failed for login_status update: " . $conn->error);
            } else {
                $stmt->bind_param('i', $user_id);
                if (!$stmt->execute()) {
                    error_log("Execute failed for login_status update: " . $stmt->error);
                } else {
                    error_log("Login status updated to 'offline' for $role ID: $user_id");
                }
                $stmt->close();
            }
        }
    }

    session_regenerate_id(true);
    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }
    session_destroy();
    error_log("Session after logout: " . json_encode($_SESSION));

    http_response_code(200);
    echo json_encode(['message' => 'Logged out successfully']);
} catch (Exception $e) {
    error_log("Exception in logout.php: " . $e->getMessage());
    // Proceed with logout even if exception occurs
    session_regenerate_id(true);
    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }
    session_destroy();
    error_log("Session after logout (exception): " . json_encode($_SESSION));
    http_response_code(200);
    echo json_encode(['message' => 'Logged out successfully']);
} finally {
    if (isset($conn) && $conn instanceof mysqli && $conn->ping()) {
        $conn->close();
    }
}
?>