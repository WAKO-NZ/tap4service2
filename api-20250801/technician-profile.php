<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://tap4service.co.nz');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', '/home/tapservi/public_html/php_errors.log');

try {
    $servername = "localhost";
    $username = "tapservi_deploy";
    $password = "WAKO123#";
    $dbname = "tapservi_tap4service";

    $conn = new mysqli($servername, $username, $password, $dbname);
    if ($conn->connect_error) {
        error_log("Database connection failed: " . $conn->connect_error);
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed: ' . $conn->connect_error]);
        exit;
    }
    error_log("Database connection successful");

    $userId = $_GET['userId'] ?? '';
    error_log("Fetching profile for userId: $userId");

    if (empty($userId) || !is_numeric($userId)) {
        error_log("Invalid or missing User ID: $userId");
        http_response_code(400);
        echo json_encode(['error' => 'Invalid or missing User ID']);
        exit;
    }

    $result = $conn->query("SHOW TABLES LIKE 'technicians'");
    if ($result->num_rows === 0) {
        error_log("Table technicians does not exist");
        http_response_code(500);
        echo json_encode(['error' => 'Table technicians does not exist']);
        exit;
    }

    $stmt = $conn->prepare("SELECT t.id, t.email, t.name, td.address, td.phone_number, td.city, td.postal_code, td.pspla_number, td.nzbn_number, td.public_liability_insurance 
                           FROM technicians t 
                           LEFT JOIN technician_details td ON t.id = td.technician_id 
                           WHERE t.id = ?");
    if (!$stmt) {
        error_log("Prepare failed: " . $conn->error);
        http_response_code(500);
        echo json_encode(['error' => 'Database query preparation failed: ' . $conn->error]);
        exit;
    }
    $stmt->bind_param("i", $userId);
    if (!$stmt->execute()) {
        error_log("Execute failed: " . $stmt->error);
        http_response_code(500);
        echo json_encode(['error' => 'Database query execution failed: ' . $stmt->error]);
        exit;
    }
    $user = $stmt->get_result()->fetch_assoc();

    if ($user) {
        error_log("Profile fetched successfully for userId: $userId");
        http_response_code(200);
        echo json_encode($user);
    } else {
        error_log("No profile found for userId: $userId");
        http_response_code(404);
        echo json_encode(['error' => 'Profile not found']);
    }

    $stmt->close();
    $conn->close();
} catch (Exception $e) {
    error_log("Exception in technician-profile.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
    exit;
}
?>