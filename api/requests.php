<?php
/**
 * requests.php - Version V1.16
 * - Handles POST requests to /api/requests?path=create to save service requests.
 * - Handles GET requests for /customer/{id} to fetch service requests.
 * - Reverted to July 30, 2025 state, pre-parse error fix.
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://tap4service.co.nz');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', '/home/tapservi/public_html/api/logs/custom_errors.log');

try {
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
    error_log("Database connection successful");

    // Verify table existence
    $tables = ['service_requests', 'customers', 'technicians', 'technician_service_regions'];
    foreach ($tables as $table) {
        $result = $conn->query("SHOW TABLES LIKE '$table'");
        if ($result->num_rows === 0) {
            error_log("Table $table does not exist");
            http_response_code(500);
            echo json_encode(['error' => "Table $table does not exist"]);
            exit;
        }
        error_log("Table $table exists");
    }

    // Verify required columns in service_requests
    $requiredColumns = [
        'id', 'customer_id', 'repair_description', 'created_at', 'status',
        'customer_availability_1', 'customer_availability_2', 'region',
        'payment_status', 'technician_id', 'technician_scheduled_time', 'technician_note', 'system_types'
    ];
    $result = $conn->query("SHOW COLUMNS FROM service_requests");
    $existingColumns = [];
    while ($row = $result->fetch_assoc()) {
        $existingColumns[] = $row['Field'];
    }
    foreach ($requiredColumns as $col) {
        if (!in_array($col, $existingColumns)) {
            error_log("Missing column in service_requests: $col");
            http_response_code(500);
            echo json_encode(['error' => "Missing column in service_requests: $col"]);
            exit;
        }
    }
    error_log("All required columns exist in service_requests");

    $method = $_SERVER['REQUEST_METHOD'];
    $query = $_SERVER['QUERY_STRING'] ?? '';
    error_log("Raw query string: $query");
    parse_str($query, $queryParams);
    $path = isset($queryParams['path']) ? (is_array($queryParams['path']) ? end($queryParams['path']) : $queryParams['path']) : '';
    $path = trim($path, '/');
    error_log("Processed path: $path");
    $request = explode('/', $path);
    $rawInput = file_get_contents('php://input');
    error_log("Raw input received: " . $rawInput);
    $data = json_decode($rawInput, true);
    if ($method === 'POST' && json_last_error() !== JSON_ERROR_NONE && !empty($rawInput)) {
        error_log("JSON decode error: " . json_last_error_msg());
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON payload']);
        exit;
    }
    error_log("Request details: method=$method, path=$path, request=" . json_encode($request) . ", query=$query");

    if ($method === 'OPTIONS') {
        http_response_code(200);
        exit;
    }

    if ($method === 'POST' && ($path === 'create' || empty($path))) {
        $customer_id = $data['customer_id'] ?? null;
        $repair_description = $data['repair_description'] ?? '';
        $availability_1 = $data['availability_1'] ?? null;
        $availability_2 = $data['availability_2'] ?? null;
        $region = $data['region'] ?? '';
        $system_types = $data['system_types'] ?? [];

        error_log("Processing create request: " . json_encode($data));

        if (empty($customer_id) || empty($repair_description) || empty($availability_1) || empty($region) || !is_array($system_types) || empty($system_types)) {
            error_log("Missing or invalid required fields: customer_id=$customer_id, repair_description=$repair_description, availability_1=$availability_1, region=$region, system_types=" . json_encode($system_types));
            http_response_code(400);
            echo json_encode(['error' => 'Missing or invalid required fields']);
            exit;
        }

        // Sanitize inputs
        $repair_description = filter_var($repair_description, FILTER_SANITIZE_STRING);
        $region = filter_var($region, FILTER_SANITIZE_STRING);
        $system_types_json = json_encode($system_types);

        // Validate repair_description length
        if (strlen($repair_description) > 255) {
            error_log("Repair description too long: length=" . strlen($repair_description));
            http_response_code(400);
            echo json_encode(['error' => 'Repair description exceeds 255 characters']);
            exit;
        }

        // Validate date formats
        $dateFormat = 'Y-m-d H:i:s';
        $d1 = DateTime::createFromFormat($dateFormat, $availability_1);
        $d2 = $availability_2 ? DateTime::createFromFormat($dateFormat, $availability_2) : null;
        if (!$d1 || ($availability_2 && !$d2)) {
            error_log("Invalid date format: availability_1=$availability_1, availability_2=$availability_2");
            http_response_code(400);
            echo json_encode(['error' => 'Invalid date format for availability']);
            exit;
        }

        // Verify customer_id exists
        $stmt = $conn->prepare("SELECT id FROM customers WHERE id = ?");
        if (!$stmt) {
            error_log("Prepare failed for customer verification: " . $conn->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database query preparation failed']);
            exit;
        }
        $stmt->bind_param('i', $customer_id);
        if (!$stmt->execute()) {
            error_log("Execute failed for customer verification: " . $stmt->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database query execution failed']);
            exit;
        }
        $result = $stmt->get_result();
        if ($result->num_rows === 0) {
            error_log("Invalid customer ID: $customer_id");
            http_response_code(403);
            echo json_encode(['error' => 'Unauthorized: Invalid customer ID']);
            exit;
        }
        $stmt->close();

        // Assign technician based on region
        $regionStmt = $conn->prepare("SELECT technician_id FROM technician_service_regions WHERE ? IN (auckland, bay_of_plenty, canterbury, gisborne, hawkes_bay, manawatu_whanganui, marlborough, nelson, northland, otago, southland, taranaki, tasman, waikato, wellington, west_coast) LIMIT 1");
        if (!$regionStmt) {
            error_log("Prepare failed for technician assignment: " . $conn->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database query preparation failed']);
            exit;
        }
        $regionStmt->bind_param('s', $region);
        if (!$regionStmt->execute()) {
            error_log("Execute failed for technician assignment: " . $regionStmt->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database query execution failed']);
            exit;
        }
        $result = $regionStmt->get_result();
        $technician_id = $result->num_rows > 0 ? $result->fetch_assoc()['technician_id'] : null;
        $regionStmt->close();

        if (!$technician_id) {
            error_log("No technician found for region: $region");
            http_response_code(400);
            echo json_encode(['error' => 'No available technician for the selected region']);
            exit;
        }

        // Insert into service_requests
        $stmt = $conn->prepare("
            INSERT INTO service_requests (
                customer_id, repair_description, customer_availability_1, customer_availability_2, region,
                system_types, status, created_at, technician_id
            ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW(), ?)
        ");
        if (!$stmt) {
            error_log("Prepare failed for service_requests insert: " . $conn->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database query preparation failed']);
            exit;
        }
        $stmt->bind_param('isssssi', $customer_id, $repair_description, $availability_1, $availability_2, $region, $system_types_json, $technician_id);
        if (!$stmt->execute()) {
            error_log("Execute failed for service_requests insert: " . $conn->error . ", Data: " . json_encode($data));
            http_response_code(500);
            echo json_encode(['error' => 'Database query execution failed']);
            exit;
        }
        $requestId = $conn->insert_id;
        $stmt->close();

        error_log("Service request submitted successfully: requestId=$requestId, technicianId=$technician_id");
        http_response_code(200);
        echo json_encode(['message' => 'Service request submitted successfully', 'requestId' => $requestId]);
        exit;
    } elseif ($method === 'GET' && count($request) >= 2 && $request[0] === 'customer' && is_numeric($request[1])) {
        $customerId = (int) $request[1];

        error_log("Fetching requests for customerId: $customerId");

        $stmt = $conn->prepare("
            SELECT sr.id, sr.repair_description, sr.created_at, sr.status,
                   sr.customer_availability_1, sr.customer_availability_2,
                   sr.technician_scheduled_time, sr.technician_id, sr.region,
                   t.name AS technician_name, sr.technician_note
            FROM service_requests sr
            LEFT JOIN technicians t ON sr.technician_id = t.id
            WHERE sr.customer_id = ?
        ");
        if (!$stmt) {
            error_log("Prepare failed for customer requests fetch: " . $conn->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database query preparation failed']);
            exit;
        }
        $stmt->bind_param('i', $customerId);
        if (!$stmt->execute()) {
            error_log("Execute failed for customer requests fetch: " . $stmt->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database query execution failed']);
            exit;
        }
        $result = $stmt->get_result();
        $requests = [];
        while ($row = $result->fetch_assoc()) {
            $requests[] = [
                'id' => (int) $row['id'],
                'repair_description' => $row['repair_description'],
                'created_at' => $row['created_at'] ? (new DateTime($row['created_at']))->format('Y-m-d H:i:s') : null,
                'status' => $row['status'],
                'customer_availability_1' => $row['customer_availability_1'] ? (new DateTime($row['customer_availability_1']))->format('Y-m-d H:i:s') : null,
                'customer_availability_2' => $row['customer_availability_2'] ? (new DateTime($row['customer_availability_2']))->format('Y-m-d H:i:s') : null,
                'technician_scheduled_time' => $row['technician_scheduled_time'] ? (new DateTime($row['technician_scheduled_time']))->format('Y-m-d H:i:s') : null,
                'technician_id' => $row['technician_id'] ? (int) $row['technician_id'] : null,
                'technician_name' => $row['technician_name'],
                'region' => $row['region'],
                'technician_note' => $row['technician_note']
            ];
        }
        $stmt->close();

        error_log("Requests fetched successfully for customerId: $customerId, count: " . count($requests));
        error_log("Returned customer requests: " . json_encode($requests));
        http_response_code(200);
        echo json_encode($requests);
        exit;
    } else {
        error_log("Invalid request: method=$method, path=$path");
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed. Use POST to create a request or GET to fetch customer requests.']);
        exit;
    }
} catch (Exception $e) {
    error_log("Exception in requests.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
} finally {
    if (isset($conn) && $conn instanceof mysqli && $conn->ping()) {
        $conn->close();
    }
}