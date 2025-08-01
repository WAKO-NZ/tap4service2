<?php
/**
 * send-acceptance-email.php - Version V1.0
 * - Sends a job acceptance email to the customer with technician details.
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
        $customerEmail = $data['customerEmail'] ?? '';
        $technicianName = $data['technicianName'] ?? '';
        $technicianId = $data['technicianId'] ?? '';
        $requestId = $data['requestId'] ?? '';
        $scheduledTime = $data['scheduledTime'] ?? '';

        if (empty($customerEmail) || empty($technicianName) || empty($technicianId) || empty($requestId) || empty($scheduledTime)) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }

        $mail = new PHPMailer(true);
        try {
            $mail->isSMTP();
            $mail->Host = 'mail.tap4service.co.nz';
            $mail->SMTPAuth = true;
            $mail->Username = 'Confirmation@tap4service.co.nz';
            $mail->Password = 'b~v__ZuL5!Ifh{m!';
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
            $mail->Port = 465;

            $mail->setFrom('Confirmation@tap4service.co.nz', 'Tap4Service Confirmation');
            $mail->addAddress($customerEmail);

            $mail->isHTML(true);
            $mail->Subject = 'Job Acceptance Confirmation';
            $mail->Body = "
              <html>
              <body>
                <p>Your service request (ID: {$requestId}) has been accepted by Technician {$technicianName} (ID: {$technicianId}).</p>
                <p><strong>Scheduled Time:</strong> " . htmlspecialchars(moment($scheduledTime, 'YYYY-MM-DD HH:mm:ss').tz('Pacific/Auckland').format('DD/MM/YYYY HH:mm:ss')) . "</p>
                <p>Please be available at the scheduled time. Contact your technician if needed.</p>
              </body>
              </html>
            ";
            $mail->AltBody = "Your service request (ID: {$requestId}) has been accepted by Technician {$technicianName} (ID: {$technicianId}). Scheduled Time: " . date('d/m/Y H:i:s', strtotime($scheduledTime)) . ". Please be available. Contact your technician if needed.";

            $mail->send();
            echo json_encode(['message' => 'Acceptance email sent successfully']);
        } catch (Exception $e) {
            error_log("Mailer Error: " . $mail->ErrorInfo);
            http_response_code(500);
            echo json_encode(['error' => 'Failed to send acceptance email']);
        }
    } catch (Exception $e) {
        error_log("Error in send-acceptance-email.php: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Server error']);
    }
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}

$conn->close();
?>