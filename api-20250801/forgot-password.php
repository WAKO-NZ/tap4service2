<?php
/**
 * forgot-password.php - Version V1.4
 * - Handles password reset requests for technicians and customers.
 * - Generates a reset token and sends an email with a reset link.
 * - Clears any existing token before generating a new one to avoid conflicts.
 * - Added transaction with rollback on failure and improved logging.
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

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

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
        $email = trim($data['email'] ?? '');

        if (empty($email)) {
            http_response_code(400);
            echo json_encode(['error' => 'Email is required']);
            exit;
        }

        // Check if email exists (for either technicians or customers)
        $stmt = $conn->prepare("SELECT id, name FROM technicians WHERE email = ? UNION SELECT id, name FROM customers WHERE email = ?");
        $stmt->bind_param('ss', $email, $email);
        $stmt->execute();
        $result = $stmt->get_result();
        $user = $result->fetch_assoc();
        $stmt->close();

        if (!$user) {
            http_response_code(404);
            echo json_encode(['error' => 'Email not found']);
            exit;
        }

        // Start transaction
        $conn->begin_transaction();
        try {
            $type = $result->num_rows > 0 && $conn->query("SELECT id FROM technicians WHERE email = '$email'")->num_rows > 0 ? 'technicians' : 'customers';
            error_log("Determined type: $type for email: $email");

            // Clear any existing token
            $stmt = $conn->prepare("UPDATE $type SET reset_token = NULL, reset_expires = NULL WHERE email = ?");
            $stmt->bind_param('s', $email);
            if (!$stmt->execute()) {
                throw new Exception("Clear failed: " . $stmt->error);
            }
            $stmt->close();

            // Generate new reset token and expiration (1 hour from now)
            $resetToken = bin2hex(random_bytes(32));
            $resetExpires = date('Y-m-d H:i:s', strtotime('+1 hour'));
            error_log("Generated token: $resetToken, expires: $resetExpires for email: $email");

            $stmt = $conn->prepare("UPDATE $type SET reset_token = ?, reset_expires = ? WHERE email = ?");
            $stmt->bind_param('sss', $resetToken, $resetExpires, $email);
            if (!$stmt->execute()) {
                throw new Exception("Update failed: " . $stmt->error);
            }
            $affectedRows = $stmt->affected_rows;
            $stmt->close();

            if ($affectedRows === 0) {
                throw new Exception("No update performed for email: $email");
            }

            $conn->commit();
            error_log("Token update successful for email: $email, table: $type, affected rows: $affectedRows");
        } catch (Exception $e) {
            $conn->rollback();
            error_log("Transaction failed: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'Failed to generate reset token']);
            exit;
        }

        // Send reset email
        $mail = new PHPMailer(true);
        try {
            $mail->isSMTP();
            $mail->Host = 'mail.tap4service.co.nz';
            $mail->SMTPAuth = true;
            $mail->Username = 'register@tap4service.co.nz';
            $mail->Password = 'e6GeNNNgr73aF3W';
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
            $mail->Port = 465;

            $mail->setFrom('register@tap4service.co.nz', 'Tap4Service Password Reset');
            $mail->addAddress($email, $user['name']);

            $mail->isHTML(true);
            $mail->Subject = 'Password Reset Request';
            $mail->Body = "
              <html>
              <body>
                <p>You requested a password reset for your Tap4Service account.</p>
                <p>Please click the button below to reset your password:</p>
                <a href='https://tap4service.co.nz/reset-password?token={$resetToken}&email={$email}&type=" . ($type === 'technicians' ? 'technician' : 'customer') . "' style='background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;'>Reset Password</a>
                <p>This link will expire in 1 hour. If you didn’t request this, ignore this email.</p>
              </body>
              </html>
            ";
            $mail->AltBody = "You requested a password reset for your Tap4Service account. Reset your password at: https://tap4service.co.nz/reset-password?token={$resetToken}&email={$email}&type=" . ($type === 'technicians' ? 'technician' : 'customer') . ". This link expires in 1 hour.";

            $mail->send();
            echo json_encode(['message' => 'Password reset email sent. Check your inbox.']);
        } catch (Exception $e) {
            $conn->rollback();
            error_log("Mailer Error: " . $mail->ErrorInfo);
            http_response_code(500);
            echo json_encode(['error' => 'Failed to send reset email']);
        }
    } catch (Exception $e) {
        error_log("Error in forgot-password.php: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Server error']);
    }
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}

$conn->close();
?>