<?php
/**
 * reset-password.php - Version V1.2
 * - Handles password reset confirmation for technicians and customers.
 * - Validates the token and updates the password.
 * - Added detailed logging for debugging invalid token issues.
 * - Logs errors to /home/tapservi/public_html/api/logs/custom_errors.log.
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

require_once '/home/tapservi/public_html/vendor/autoload.php';

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
$data = json_decode($rawInput, true);
if (json_last_error() !== JSON_ERROR_NONE && $rawInput) {
    error_log("JSON decode error: " . json_last_error_msg());
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON payload']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $token = $data['token'] ?? '';
        $email = $data['email'] ?? '';
        $password = $data['password'] ?? '';
        $type = $data['type'] ?? '';

        error_log("Reset request: token=$token, email=$email, type=$type, raw_input=$rawInput"); // Enhanced logging

        if (empty($token) || empty($email) || empty($password) || empty($type)) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }

        $table = $type === 'technician' ? 'technicians' : 'customers';
        error_log("Validating against table: $table"); // Debug table selection
        $stmt = $conn->prepare("SELECT id, reset_token, reset_expires FROM $table WHERE email = ? AND reset_token = ?");
        $stmt->bind_param('ss', $email, $token);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        error_log("Query result: " . json_encode($row)); // Log the full row

        if (!$row || $row['reset_expires'] === null || strtotime($row['reset_expires']) < time()) {
            error_log("Token validation failed: email=$email, token=$token, stored_token=" . ($row['reset_token'] ?? 'null') . ", expires=" . ($row['reset_expires'] ?? 'null') . ", now=" . date('Y-m-d H:i:s'));
            http_response_code(400);
            echo json_encode(['error' => 'Invalid or expired reset token']);
            exit;
        }
        $stmt->close();

        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $conn->prepare("UPDATE $table SET password = ?, reset_token = NULL, reset_expires = NULL WHERE email = ?");
        $stmt->bind_param('ss', $hashedPassword, $email);
        if (!$stmt->execute()) {
            error_log("Update failed: " . $stmt->error);
            http_response_code(500);
            echo json_encode(['error' => 'Failed to reset password']);
            exit;
        }
        $stmt->close();

        echo json_encode(['message' => 'Password reset successfully.']);
    } catch (Exception $e) {
        error_log("Error in reset-password.php: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Server error']);
    }
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}

$conn->close();
?>