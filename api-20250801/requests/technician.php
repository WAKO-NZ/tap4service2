<?php
/**
 * technician.php - Version V1.1
 * - Fetches assigned and completed requests for a technician.
 * - Includes customer email from the customers table.
 * - Logs errors to /home/tapservi/public_html/api/logs/custom_errors.log.
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://tap4service.co.nz');
header('Access-Control-Allow-Methods: GET');
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

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $technicianId = $_GET['id'] ?? null;

        if (!$technicianId) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing technicianId']);
            exit;
        }

        $stmt = $conn->prepare("SELECT sr.*, c.email FROM service_requests sr JOIN customers c ON sr.customer_id = c.id WHERE sr.technician_id = ?");
        $stmt->bind_param('i', $technicianId);
        $stmt->execute();
        $result = $stmt->get_result();
        $requests = [];
        while ($row = $result->fetch_assoc()) {
            $requests[] = $row;
        }
        $stmt->close();

        error_log("Requests fetched successfully for technicianId: $technicianId, count: " . count($requests));
        error_log("Returned assigned requests: " . json_encode($requests));
        echo json_encode($requests);
    } catch (Exception $e) {
        error_log("Error in technician.php: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Server error']);
    }
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}

$conn->close();
?>