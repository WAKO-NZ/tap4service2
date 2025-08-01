<?php
/**
 * verify.php - Version V1.1
 * - Updates the status of a technician or customer to 'active' upon email verification.
 * - No redirection to login page; only returns a success message.
 * - Logs errors to /home/tapservi/public_html/api/logs/custom_errors.log.
 */
header('Content-Type: application/json');

ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', '/home/tapservi/public_html/api/logs/custom_errors.log');

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

$token = $_GET['token'] ?? '';
$email = $_GET['email'] ?? '';
$type = $_GET['type'] ?? '';

if (empty($token) || empty($email) || empty($type)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing token, email, or type parameter']);
    exit;
}

try {
    if ($type === 'technician') {
        $stmt = $conn->prepare("UPDATE technicians SET status = 'active', verification_token = NULL WHERE email = ? AND verification_token = ? AND status = 'pending'");
        $stmt->bind_param('ss', $email, $token);
    } elseif ($type === 'customer') {
        $stmt = $conn->prepare("UPDATE customers SET status = 'active', verification_token = NULL WHERE email = ? AND verification_token = ? AND status = 'pending'");
        $stmt->bind_param('ss', $email, $token);
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid type parameter']);
        exit;
    }

    if (!$stmt->execute()) {
        error_log("Update failed: " . $stmt->error);
        http_response_code(500);
        echo json_encode(['error' => 'Verification failed']);
        exit;
    }

    $affectedRows = $stmt->affected_rows;
    $stmt->close();

    if ($affectedRows > 0) {
        echo json_encode(['message' => 'Email verified successfully. Your account is now active.']);
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid token or email, or account already verified']);
    }
} catch (Exception $e) {
    error_log("Error in verification: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Server error']);
}

$conn->close();
?>