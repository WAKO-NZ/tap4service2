<?php
/**
 * unassign.php - Version V1.1
 * - Handles job unassignment by a technician.
 * - Updates service_requests to remove technician_id and set unassignable.
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
    error_log("JSON decode error: " . json_last_error_msg());
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON payload']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    try {
        $requestId = $_GET['id'] ?? null;
        $technicianId = $data['technicianId'] ?? null;
        $unassignable = $data['unassignable'] ?? 1; // Default to 1 to prevent re-acceptance

        if (!$requestId || !$technicianId) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }

        $stmt = $conn->prepare("UPDATE service_requests SET technician_id = NULL, technician_scheduled_time = NULL, status = 'pending', unassignable = ? WHERE id = ? AND technician_id = ?");
        $stmt->bind_param('iii', $unassignable, $requestId, $technicianId);
        if (!$stmt->execute()) {
            error_log("Update failed: " . $stmt->error);
            http_response_code(500);
            echo json_encode(['error' => 'Failed to unassign request']);
            exit;
        }
        $affectedRows = $stmt->affected_rows;
        $stmt->close();

        if ($affectedRows === 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Request not assigned to this technician']);
            exit;
        }

        echo json_encode(['message' => 'Request unassigned successfully']);
    } catch (Exception $e) {
        error_log("Error in unassign.php: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Server error']);
    }
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}

$conn->close();
?>