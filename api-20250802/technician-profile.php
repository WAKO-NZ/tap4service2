<?php
/**
 * technician-profile.php - Version V1.0
 * - Handles fetching technician profile data via GET /api/technician-profile.php.
 * - Validates session to prevent unauthorized access.
 * - Uses correct database credentials to avoid 500 errors.
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://tap4service.co.nz');
header('Access-Control-Allow-Methods: GET, OPTIONS');
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

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }

    if (!isset($_SESSION['user_id']) || !isset($_SESSION['role']) || $_SESSION['role'] !== 'technician') {
        error_log("Unauthorized access attempt: session=" . json_encode($_SESSION));
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    $technician_id = $_SESSION['user_id'];

    $stmt = $conn->prepare("SELECT t.id, t.email, t.name, td.address, td.phone_number, td.city, td.postal_code, td.pspla_number, td.nzbn_number, td.public_liability_insurance FROM technicians t LEFT JOIN technician_details td ON t.id = td.technician_id WHERE t.id = ?");
    if (!$stmt) {
        error_log("Prepare failed: " . $conn->error);
        http_response_code(500);
        echo json_encode(['error' => 'Database query preparation failed: ' . $conn->error]);
        exit;
    }
    $stmt->bind_param('i', $technician_id);
    if (!$stmt->execute()) {
        error_log("Execute failed: " . $stmt->error);
        http_response_code(500);
        echo json_encode(['error' => 'Database query execution failed: ' . $stmt->error]);
        exit;
    }
    $result = $stmt->get_result();
    $profile = $result->fetch_assoc();
    $stmt->close();

    if (!$profile) {
        error_log("No profile found for technician ID: $technician_id");
        http_response_code(404);
        echo json_encode(['error' => 'Profile not found']);
        exit;
    }

    error_log("Profile fetched successfully for technician ID: $technician_id");
    http_response_code(200);
    echo json_encode(['profile' => $profile]);
} catch (Exception $e) {
    error_log("Exception in technician-profile.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
} finally {
    if (isset($conn) && $conn instanceof mysqli && $conn->ping()) {
        $conn->close();
    }
}
?>