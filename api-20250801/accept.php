<?php
/**
 * accept.php - Version V1.2
 * - Handles job acceptance by a technician.
 * - Updates service_requests with technician_id and scheduled_time.
 * - Triggers sending of acceptance email to customer.
 * - Added validation and logging for debugging.
 * - Logs errors to /home/tapservi/public_html/api/logs/custom_errors.log.
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://tap4service.co.nz');
header('Access-Control-Allow-Methods: PUT');
header('Access-Control-Allow-Headers: Content-Type');

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

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);
if (json_last_error() !== JSON_ERROR_NONE && $rawInput) {
    error_log("JSON decode error: " . json_last_error_msg() . ", Raw input: " . $rawInput);
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON payload']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    try {
        $requestId = $_GET['id'] ?? null;
        $technicianId = $data['technicianId'] ?? null;
        $scheduledTime = $data['scheduledTime'] ?? null;

        error_log("Accept request: requestId=$requestId, technicianId=$technicianId, scheduledTime=$scheduledTime"); // Debug log

        if (!$requestId || !$technicianId || !$scheduledTime) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }

        $stmt = $conn->prepare("UPDATE service_requests SET technician_id = ?, technician_scheduled_time = ?, status = 'assigned' WHERE id = ? AND technician_id IS NULL AND unassignable = 0");
        $stmt->bind_param('iss', $technicianId, $scheduledTime, $requestId);
        if (!$stmt->execute()) {
            error_log("Update failed: " . $stmt->error);
            http_response_code(500);
            echo json_encode(['error' => 'Failed to accept request']);
            exit;
        }
        $affectedRows = $stmt->affected_rows;
        $stmt->close();

        if ($affectedRows === 0) {
            error_log("No rows affected: Request already assigned or unassignable for ID $requestId");
            http_response_code(400);
            echo json_encode(['error' => 'Request already assigned or unassignable']);
            exit;
        }

        // Fetch customer email for the request
        $stmt = $conn->prepare("SELECT c.email FROM service_requests sr JOIN customers c ON sr.customer_id = c.id WHERE sr.id = ?");
        $stmt->bind_param('i', $requestId);
        $stmt->execute();
        $result = $stmt->get_result();
        $customer = $result->fetch_assoc();
        $stmt->close();

        if ($customer && $customer['email']) {
            $emailResponse = file_get_contents("{$_SERVER['SERVER_NAME']}/api/send-acceptance-email", false, stream_context_create([
                'http' => [
                    'method' => 'POST',
                    'header' => 'Content-Type: application/json',
                    'content' => json_encode([
                        'customerEmail' => $customer['email'],
                        'technicianName' => $conn->query("SELECT name FROM technicians WHERE id = $technicianId")->fetch_assoc()['name'] ?? 'Unknown Technician',
                        'technicianId' => $technicianId,
                        'requestId' => $requestId,
                        'scheduledTime' => $scheduledTime
                    ])
                ]
            ]));
            $emailData = json_decode($emailResponse, true);
            if (!$emailData || isset($emailData['error'])) {
                error_log("Email sending failed: " . ($emailData['error'] ?? 'Unknown error'));
            } else {
                error_log("Email sent successfully for request ID: $requestId");
            }
        } else {
            error_log("No customer email found for request ID: $requestId");
        }

        echo json_encode(['message' => 'Request accepted successfully']);
    } catch (Exception $e) {
        error_log("Error in accept.php: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Server error']);
    }
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}

$conn->close();
?>