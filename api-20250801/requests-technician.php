<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://tap4service.co.nz');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

ini_set('display_errors', 0); // Prevent HTML output
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', '/home/tapservi/public_html/php_errors.log');

try {
    // Database configuration
    $servername = "localhost";
    $username = "tapservi_deploy";
    $password = "WAKO123#";
    $dbname = "tapservi_tap4service";

    // Connect to database
    $conn = new mysqli($servername, $username, $password, $dbname);
    if ($conn->connect_error) {
        error_log("Database connection failed: " . $conn->connect_error);
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed: ' . $conn->connect_error]);
        exit;
    }
    error_log("Database connection successful");

    // Get technicianId from query parameter
    $technicianId = $_GET['technicianId'] ?? '';
    error_log("Fetching requests for technicianId: $technicianId");

    if (empty($technicianId) || !is_numeric($technicianId)) {
        error_log("Invalid or missing Technician ID: $technicianId");
        http_response_code(400);
        echo json_encode(['error' => 'Invalid or missing Technician ID']);
        exit;
    }

    // Verify service_requests table exists
    $result = $conn->query("SHOW TABLES LIKE 'service_requests'");
    if ($result->num_rows === 0) {
        error_log("Table service_requests does not exist");
        http_response_code(500);
        echo json_encode(['error' => 'Table service_requests does not exist']);
        exit;
    }
    error_log("Table service_requests exists");

    // Check table columns
    $requiredColumns = ['id', 'customer_id', 'service_type', 'description', 'status', 'created_at', 'technician_id', 'technician_scheduled_time', 'customer_availability_1', 'customer_availability_2', 'technician_note'];
    $result = $conn->query("DESCRIBE service_requests");
    $existingColumns = [];
    while ($row = $result->fetch_assoc()) {
        $existingColumns[] = $row['Field'];
    }
    $missingColumns = array_diff($requiredColumns, $existingColumns);
    if (!empty($missingColumns)) {
        error_log("Missing columns in service_requests: " . implode(', ', $missingColumns));
        http_response_code(500);
        echo json_encode(['error' => 'Missing columns in service_requests: ' . implode(', ', $missingColumns)]);
        exit;
    }
    error_log("All required columns exist in service_requests");

    // Query service_requests table
    $stmt = $conn->prepare("SELECT id, customer_id, service_type, description AS repair_description, status, created_at, technician_id, technician_scheduled_time, customer_availability_1, customer_availability_2, technician_note 
                           FROM service_requests 
                           WHERE technician_id = ?");
    if (!$stmt) {
        error_log("Prepare failed: " . $conn->error);
        http_response_code(500);
        echo json_encode(['error' => 'Database query preparation failed: ' . $conn->error]);
        exit;
    }
    $stmt->bind_param("i", $technicianId);
    if (!$stmt->execute()) {
        error_log("Execute failed: " . $stmt->error);
        http_response_code(500);
        echo json_encode(['error' => 'Database query execution failed: ' . $stmt->error]);
        exit;
    }
    $result = $stmt->get_result();
    $requests = [];
    while ($row = $result->fetch_assoc()) {
        $requests[] = [
            'id' => $row['id'],
            'customer_id' => $row['customer_id'],
            'service_type' => $row['service_type'],
            'repair_description' => $row['repair_description'],
            'status' => $row['status'],
            'created_at' => $row['created_at'],
            'technician_id' => $row['technician_id'],
            'technician_scheduled_time' => $row['technician_scheduled_time'],
            'customer_availability_1' => $row['customer_availability_1'],
            'customer_availability_2' => $row['customer_availability_2'],
            'technician_note' => $row['technician_note'],
            'customer_name' => 'Unknown', // Adjust if joining customers table
            'customer_address' => null,
            'customer_city' => null,
            'customer_postal_code' => null
        ];
    }

    error_log("Requests fetched successfully for technicianId: $technicianId, count: " . count($requests));
    http_response_code(200);
    echo json_encode($requests);

    $stmt->close();
    $conn->close();
} catch (Exception $e) {
    error_log("Exception in requests-technician.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
    exit;
}
?>