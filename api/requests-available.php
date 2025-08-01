<?php
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: https://tap4service.co.nz');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');

    ini_set('display_errors', 1);
    ini_set('display_startup_errors', 1);
    error_reporting(E_ALL);
    ini_set('log_errors', 1);
    $logPath = '/home/tapservi/public_html/php_errors.log';
    if (!is_writable(dirname($logPath)) && function_exists('error_log')) {
        error_log('Custom log path not writable, using default.');
        ini_set('error_log', '/tmp/php_errors.log');
    } else {
        ini_set('error_log', $logPath);
    }

    $servername = "localhost";
    $username = "tapservi_deploy";
    $password = "WAKO123#";
    $dbname = "tapservi_tap4service";

    $conn = new mysqli($servername, $username, $password, $dbname);

    if ($conn->connect_error) {
        error_log("Database connection failed: " . $conn->connect_error);
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        exit;
    }

    $technicianId = $_GET['technicianId'] ?? '';
    error_log("Fetching available requests for technicianId: $technicianId");

    if (empty($technicianId) || !is_numeric($technicianId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid or missing Technician ID']);
        exit;
    }

    // Example query: Fetch unassigned requests (adjust based on schema)
    $stmt = $conn->prepare("SELECT id, customer_id, service_type, description, status, created_at 
                           FROM service_requests 
                           WHERE technician_id IS NULL");
    $stmt->execute();
    $result = $stmt->get_result();
    $requests = [];
    while ($row = $result->fetch_assoc()) {
        $requests[] = $row;
    }

    error_log("Available requests fetched successfully for technicianId: $technicianId");
    http_response_code(200);
    echo json_encode($requests);

    $stmt->close();
    $conn->close();
    ?>