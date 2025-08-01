<?php
/**
 * requests.php - Version V1.46
 * - Handles service request operations for customers and technicians.
 * - Supports creating, fetching, and updating requests in Customer_Request and Technician_Feedback tables.
 * - Validates session to prevent unauthorized access.
 * - Uses POST /api/requests for customer and technician requests to comply with MyHost restrictions.
 * - Uses database credentials (tapservi_deploy, WAKO123#, tapservi_tap4service).
 * - Enhanced session validation to fix 403 errors.
 * - Validates schema to align with tapservi_tap4service (8).sql.
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://tap4service.co.nz');
header('Access-Control-Allow-Methods: POST, PUT, OPTIONS');
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

    // Check required tables
    $required_tables = ['Customer_Request', 'Technician_Feedback', 'customers', 'technicians', 'technician_service_regions', 'customer_details'];
    foreach ($required_tables as $table) {
        $result = $conn->query("SHOW TABLES LIKE '$table'");
        if ($result->num_rows === 0) {
            error_log("Table $table does not exist");
            http_response_code(500);
            echo json_encode(['error' => "Table $table does not exist"]);
            exit;
        }
        error_log("Table $table exists");
    }

    // Validate required columns in Customer_Request
    $result = $conn->query("SHOW COLUMNS FROM Customer_Request");
    $required_columns = ['id', 'customer_id', 'repair_description', 'created_at', 'status', 'customer_availability_1', 'customer_availability_2', 'region', 'system_types', 'technician_id'];
    $existing_columns = [];
    while ($row = $result->fetch_assoc()) {
        $existing_columns[] = $row['Field'];
    }
    foreach ($required_columns as $column) {
        if (!in_array($column, $existing_columns)) {
            error_log("Column $column missing in Customer_Request");
            http_response_code(500);
            echo json_encode(['error' => "Column $column missing in Customer_Request"]);
            exit;
        }
    }
    error_log("All required columns exist in Customer_Request");

    // Validate required columns in Technician_Feedback
    $result = $conn->query("SHOW COLUMNS FROM Technician_Feedback");
    $required_columns = ['id', 'technician_id', 'technician_scheduled_time', 'technician_note', 'payment_status'];
    $existing_columns = [];
    while ($row = $result->fetch_assoc()) {
        $existing_columns[] = $row['Field'];
    }
    foreach ($required_columns as $column) {
        if (!in_array($column, $existing_columns)) {
            error_log("Column $column missing in Technician_Feedback");
            http_response_code(500);
            echo json_encode(['error' => "Column $column missing in Technician_Feedback"]);
            exit;
        }
    }
    error_log("All required columns exist in Technician_Feedback");

    // Validate required columns in customers
    $result = $conn->query("SHOW COLUMNS FROM customers");
    $required_columns = ['id', 'email', 'password', 'name', 'surname', 'region', 'login_status', 'status', 'verification_token', 'created_at'];
    $existing_columns = [];
    while ($row = $result->fetch_assoc()) {
        $existing_columns[] = $row['Field'];
    }
    foreach ($required_columns as $column) {
        if (!in_array($column, $existing_columns)) {
            error_log("Column $column missing in customers");
            http_response_code(500);
            echo json_encode(['error' => "Column $column missing in customers"]);
            exit;
        }
    }
    error_log("All required columns exist in customers");

    $method = $_SERVER['REQUEST_METHOD'];
    $rawInput = file_get_contents('php://input');
    error_log("Raw input received: " . $rawInput);
    $data = !empty($rawInput) ? json_decode($rawInput, true) : null;
    if ($rawInput && json_last_error() !== JSON_ERROR_NONE) {
        error_log("JSON decode error: " . json_last_error_msg());
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON payload']);
        exit;
    }
    error_log("Request details: method=$method, data=" . json_encode($data));

    if ($method === 'OPTIONS') {
        http_response_code(200);
        exit;
    }

    if (!isset($_SESSION['user_id']) || !isset($_SESSION['role']) || !in_array($_SESSION['role'], ['customer', 'technician'])) {
        error_log("Unauthorized access attempt: session=" . json_encode($_SESSION));
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    $user_id = $_SESSION['user_id'];
    $role = $_SESSION['role'];

    if ($method === 'POST' && isset($data['path']) && strpos($data['path'], 'customer/') === 0 && $role === 'customer') {
        $path_parts = explode('/', trim($data['path'], '/'));
        if (count($path_parts) !== 2 || $path_parts[0] !== 'customer') {
            error_log("Invalid path: " . $data['path']);
            http_response_code(400);
            echo json_encode(['error' => 'Invalid path']);
            exit;
        }
        $customer_id = (int)$path_parts[1];
        if ($customer_id != $user_id) {
            error_log("Unauthorized: customerId does not match session user_id");
            http_response_code(403);
            echo json_encode(['error' => 'Unauthorized']);
            exit;
        }

        error_log("Fetching requests for customerId: $customer_id");
        $stmt = $conn->prepare("SELECT cr.id, cr.repair_description, cr.created_at, cr.status, cr.customer_availability_1, cr.customer_availability_2, cr.region, cr.system_types, tf.technician_id, tf.technician_scheduled_time, tf.technician_note, tf.payment_status, t.name AS technician_name FROM Customer_Request cr LEFT JOIN Technician_Feedback tf ON cr.id = tf.id LEFT JOIN technicians t ON tf.technician_id = t.id WHERE cr.customer_id = ?");
        if (!$stmt) {
            error_log("Prepare failed: " . $conn->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database query preparation failed: ' . $conn->error]);
            exit;
        }
        $stmt->bind_param('i', $customer_id);
        if (!$stmt->execute()) {
            error_log("Execute failed: " . $stmt->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database query execution failed: ' . $stmt->error]);
            exit;
        }
        $result = $stmt->get_result();
        $requests = [];
        while ($row = $result->fetch_assoc()) {
            $row['system_types'] = json_decode($row['system_types'], true);
            $requests[] = $row;
        }
        $stmt->close();

        error_log("Requests fetched successfully for customerId: $customer_id, count: " . count($requests));
        http_response_code(200);
        echo json_encode(['requests' => $requests]);
    } elseif ($method === 'POST' && isset($data['path']) && $data['path'] === 'create' && $role === 'customer') {
        if (!isset($data['customer_id']) || !isset($data['repair_description']) || !isset($data['availability_1']) || !isset($data['region']) || !isset($data['system_types'])) {
            error_log("Missing required fields: " . json_encode($data));
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }

        if ($data['customer_id'] != $user_id) {
            error_log("Unauthorized: customer_id does not match session user_id");
            http_response_code(403);
            echo json_encode(['error' => 'Unauthorized']);
            exit;
        }

        $repair_description = trim($data['repair_description']);
        $availability_1 = $data['availability_1'];
        $region = trim($data['region']);
        $system_types = json_encode($data['system_types']);

        if (strlen($repair_description) > 255) {
            error_log("Invalid repair_description: exceeds 255 characters");
            http_response_code(400);
            echo json_encode(['error' => 'Repair description must not exceed 255 characters']);
            exit;
        }

        if (!in_array($region, ['Auckland', 'Bay of Plenty', 'Canterbury', 'Gisborne', 'Hawkes Bay', 'Manawatu-Whanganui', 'Marlborough', 'Nelson', 'Northland', 'Otago', 'Southland', 'Taranaki', 'Tasman', 'Waikato', 'Wellington', 'West Coast'])) {
            error_log("Invalid region: $region");
            http_response_code(400);
            echo json_encode(['error' => 'Invalid region']);
            exit;
        }

        $conn->begin_transaction();
        try {
            $stmt = $conn->prepare("INSERT INTO Customer_Request (customer_id, repair_description, created_at, status, customer_availability_1, region, system_types) VALUES (?, ?, NOW(), 'pending', ?, ?, ?)");
            if (!$stmt) {
                error_log("Prepare failed for Customer_Request: " . $conn->error);
                throw new Exception("Database query preparation failed: " . $conn->error);
            }
            $stmt->bind_param('issss', $data['customer_id'], $repair_description, $availability_1, $region, $system_types);
            if (!$stmt->execute()) {
                error_log("Execute failed for Customer_Request: " . $stmt->error);
                throw new Exception("Database query execution failed: " . $stmt->error);
            }
            $request_id = $conn->insert_id;
            $stmt->close();

            $stmt = $conn->prepare("INSERT INTO Technician_Feedback (id, payment_status) VALUES (?, 'pending')");
            if (!$stmt) {
                error_log("Prepare failed for Technician_Feedback: " . $conn->error);
                throw new Exception("Database query preparation failed: " . $conn->error);
            }
            $stmt->bind_param('i', $request_id);
            if (!$stmt->execute()) {
                error_log("Execute failed for Technician_Feedback: " . $stmt->error);
                throw new Exception("Database query execution failed: " . $stmt->error);
            }
            $stmt->close();

            $conn->commit();
            error_log("Service request created successfully: requestId=$request_id");
            http_response_code(200);
            echo json_encode(['message' => 'Service request submitted successfully', 'requestId' => $request_id]);
        } catch (Exception $e) {
            $conn->rollback();
            error_log("Transaction failed: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'Failed to create service request: ' . $e->getMessage()]);
            exit;
        }
    } elseif ($method === 'POST' && isset($data['path']) && $data['path'] === 'available' && $role === 'technician') {
        $technician_id = isset($data['technicianId']) ? (int)$data['technicianId'] : $user_id;
        if ($technician_id != $user_id) {
            error_log("Unauthorized: technicianId does not match session user_id");
            http_response_code(403);
            echo json_encode(['error' => 'Unauthorized']);
            exit;
        }

        error_log("Fetching available requests for technicianId: $technician_id");
        $stmt = $conn->prepare("SELECT auckland, bay_of_plenty, canterbury, gisborne, hawkes_bay, manawatu_whanganui, marlborough, nelson, northland, otago, southland, taranaki, tasman, waikato, wellington, west_coast FROM technician_service_regions WHERE technician_id = ?");
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
            echo json_encode(['error' => 'Database query execution failed: ' . $conn->error]);
            exit;
        }
        $result = $stmt->get_result();
        $regions = $result->fetch_assoc();
        $stmt->close();

        $available_regions = [];
        foreach ($regions as $region => $value) {
            if ($value == 1) {
                $available_regions[] = str_replace('_', ' ', ucwords($region));
            }
        }
        error_log("Technician regions for ID $technician_id: " . json_encode($available_regions));

        $unassignable = isset($data['unassignable']) && $data['unassignable'] == '1' ? true : false;
        $query = "SELECT cr.id, cr.customer_id, cr.repair_description, cr.created_at, cr.status, cr.customer_availability_1, cr.customer_availability_2, cr.region, cr.system_types, c.name AS customer_name, c.email, cd.address AS customer_address, cd.city AS customer_city, cd.postal_code AS customer_postal_code, cd.phone_number AS customer_phone_number, cd.alternate_phone_number AS customer_alternate_phone_number FROM Customer_Request cr JOIN customers c ON cr.customer_id = c.id LEFT JOIN customer_details cd ON cr.customer_id = cd.customer_id WHERE cr.status = 'pending'";
        if (!$unassignable) {
            $query .= " AND cr.region IN (" . implode(',', array_fill(0, count($available_regions), '?')) . ")";
        }
        $stmt = $conn->prepare($query);
        if (!$stmt) {
            error_log("Prepare failed: " . $conn->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database query preparation failed: ' . $conn->error]);
            exit;
        }
        if (!$unassignable) {
            $stmt->bind_param(str_repeat('s', count($available_regions)), ...$available_regions);
        }
        if (!$stmt->execute()) {
            error_log("Execute failed: " . $stmt->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database query execution failed: ' . $stmt->error]);
            exit;
        }
        $result = $stmt->get_result();
        $requests = [];
        while ($row = $result->fetch_assoc()) {
            $row['system_types'] = json_decode($row['system_types'], true);
            $requests[] = $row;
        }
        $stmt->close();

        error_log("Available requests fetched successfully for technicianId: $technician_id, count: " . count($requests));
        http_response_code(200);
        echo json_encode($requests);
    } elseif ($method === 'POST' && isset($data['path']) && strpos($data['path'], 'technician/') === 0 && $role === 'technician') {
        $path_parts = explode('/', trim($data['path'], '/'));
        if (count($path_parts) !== 2 || $path_parts[0] !== 'technician') {
            error_log("Invalid path: " . $data['path']);
            http_response_code(400);
            echo json_encode(['error' => 'Invalid path']);
            exit;
        }
        $technician_id = (int)$path_parts[1];
        if ($technician_id != $user_id) {
            error_log("Unauthorized: technicianId does not match session user_id");
            http_response_code(403);
            echo json_encode(['error' => 'Unauthorized']);
            exit;
        }

        error_log("Fetching requests for technicianId: $technician_id");
        $stmt = $conn->prepare("SELECT cr.id, cr.repair_description, cr.created_at, cr.status, cr.customer_availability_1, cr.customer_availability_2, cr.region, cr.system_types, tf.technician_id, tf.technician_scheduled_time, tf.technician_note, tf.payment_status, c.name AS customer_name, c.email, cd.address AS customer_address, cd.city AS customer_city, cd.postal_code AS customer_postal_code, cd.phone_number AS customer_phone_number, cd.alternate_phone_number AS customer_alternate_phone_number FROM Customer_Request cr JOIN customers c ON cr.customer_id = c.id LEFT JOIN customer_details cd ON cr.customer_id = cd.customer_id LEFT JOIN Technician_Feedback tf ON cr.id = tf.id WHERE tf.technician_id = ? AND cr.status IN ('assigned', 'completed_technician', 'completed')");
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
        $requests = [];
        while ($row = $result->fetch_assoc()) {
            $row['system_types'] = json_decode($row['system_types'], true);
            $requests[] = $row;
        }
        $stmt->close();

        error_log("Requests fetched successfully for technicianId: $technician_id, count: " . count($requests));
        http_response_code(200);
        echo json_encode($requests);
    } elseif ($method === 'PUT' && isset($data['path']) && strpos($data['path'], 'accept/') === 0 && $role === 'technician') {
        $path_parts = explode('/', trim($data['path'], '/'));
        if (count($path_parts) !== 2 || $path_parts[0] !== 'accept') {
            error_log("Invalid path: " . $data['path']);
            http_response_code(400);
            echo json_encode(['error' => 'Invalid path']);
            exit;
        }
        $request_id = (int)$path_parts[1];
        if ($request_id <= 0) {
            error_log("Invalid request ID: $request_id");
            http_response_code(400);
            echo json_encode(['error' => 'Invalid request ID']);
            exit;
        }

        if (!isset($data['technicianId']) || !isset($data['scheduledTime'])) {
            error_log("Missing required fields: " . json_encode($data));
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }

        $technician_id = (int)$data['technicianId'];
        if ($technician_id != $user_id) {
            error_log("Unauthorized: technicianId does not match session user_id");
            http_response_code(403);
            echo json_encode(['error' => 'Unauthorized']);
            exit;
        }

        $scheduled_time = $data['scheduledTime'];
        $conn->begin_transaction();
        try {
            $stmt = $conn->prepare("UPDATE Customer_Request SET status = 'assigned', technician_id = ? WHERE id = ? AND status = 'pending'");
            if (!$stmt) {
                error_log("Prepare failed for Customer_Request update: " . $conn->error);
                throw new Exception("Database query preparation failed: " . $conn->error);
            }
            $stmt->bind_param('ii', $technician_id, $request_id);
            if (!$stmt->execute()) {
                error_log("Execute failed for Customer_Request update: " . $stmt->error);
                throw new Exception("Database query execution failed: " . $stmt->error);
            }
            if ($stmt->affected_rows === 0) {
                error_log("Request not found or already assigned: requestId=$request_id");
                throw new Exception("Request not found or already assigned");
            }
            $stmt->close();

            $stmt = $conn->prepare("UPDATE Technician_Feedback SET technician_id = ?, technician_scheduled_time = ? WHERE id = ?");
            if (!$stmt) {
                error_log("Prepare failed for Technician_Feedback update: " . $conn->error);
                throw new Exception("Database query preparation failed: " . $conn->error);
            }
            $stmt->bind_param('isi', $technician_id, $scheduled_time, $request_id);
            if (!$stmt->execute()) {
                error_log("Execute failed for Technician_Feedback update: " . $stmt->error);
                throw new Exception("Database query execution failed: " . $stmt->error);
            }
            $stmt->close();

            $conn->commit();
            error_log("Request accepted successfully: requestId=$request_id, technicianId=$technician_id");
            http_response_code(200);
            echo json_encode(['message' => 'Request accepted successfully']);
        } catch (Exception $e) {
            $conn->rollback();
            error_log("Transaction failed: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'Failed to accept request: ' . $e->getMessage()]);
            exit;
        }
    } elseif ($method === 'PUT' && isset($data['path']) && strpos($data['path'], 'unassign/') === 0 && $role === 'technician') {
        $path_parts = explode('/', trim($data['path'], '/'));
        if (count($path_parts) !== 2 || $path_parts[0] !== 'unassign') {
            error_log("Invalid path: " . $data['path']);
            http_response_code(400);
            echo json_encode(['error' => 'Invalid path']);
            exit;
        }
        $request_id = (int)$path_parts[1];
        if ($request_id <= 0) {
            error_log("Invalid request ID: $request_id");
            http_response_code(400);
            echo json_encode(['error' => 'Invalid request ID']);
            exit;
        }

        if (!isset($data['technicianId']) || !isset($data['unassignable'])) {
            error_log("Missing required fields: " . json_encode($data));
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }

        $technician_id = (int)$data['technicianId'];
        if ($technician_id != $user_id) {
            error_log("Unauthorized: technicianId does not match session user_id");
            http_response_code(403);
            echo json_encode(['error' => 'Unauthorized']);
            exit;
        }

        $conn->begin_transaction();
        try {
            $stmt = $conn->prepare("UPDATE Customer_Request SET status = 'pending', technician_id = NULL WHERE id = ? AND technician_id = ? AND status = 'assigned'");
            if (!$stmt) {
                error_log("Prepare failed for Customer_Request update: " . $conn->error);
                throw new Exception("Database query preparation failed: " . $conn->error);
            }
            $stmt->bind_param('ii', $request_id, $technician_id);
            if (!$stmt->execute()) {
                error_log("Execute failed for Customer_Request update: " . $stmt->error);
                throw new Exception("Database query execution failed: " . $stmt->error);
            }
            if ($stmt->affected_rows === 0) {
                error_log("Request not found or not assigned to technician: requestId=$request_id");
                throw new Exception("Request not found or not assigned to technician");
            }
            $stmt->close();

            $stmt = $conn->prepare("UPDATE Technician_Feedback SET technician_id = NULL, technician_scheduled_time = NULL WHERE id = ?");
            if (!$stmt) {
                error_log("Prepare failed for Technician_Feedback update: " . $conn->error);
                throw new Exception("Database query preparation failed: " . $conn->error);
            }
            $stmt->bind_param('i', $request_id);
            if (!$stmt->execute()) {
                error_log("Execute failed for Technician_Feedback update: " . $stmt->error);
                throw new Exception("Database query execution failed: " . $stmt->error);
            }
            $stmt->close();

            $conn->commit();
            error_log("Request unassigned successfully: requestId=$request_id, technicianId=$technician_id");
            http_response_code(200);
            echo json_encode(['message' => 'Request unassigned successfully']);
        } catch (Exception $e) {
            $conn->rollback();
            error_log("Transaction failed: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'Failed to unassign request: ' . $e->getMessage()]);
            exit;
        }
    } elseif ($method === 'PUT' && isset($data['path']) && strpos($data['path'], 'complete-technician/') === 0 && $role === 'technician') {
        $path_parts = explode('/', trim($data['path'], '/'));
        if (count($path_parts) !== 2 || $path_parts[0] !== 'complete-technician') {
            error_log("Invalid path: " . $data['path']);
            http_response_code(400);
            echo json_encode(['error' => 'Invalid path']);
            exit;
        }
        $request_id = (int)$path_parts[1];
        if ($request_id <= 0) {
            error_log("Invalid request ID: $request_id");
            http_response_code(400);
            echo json_encode(['error' => 'Invalid request ID']);
            exit;
        }

        if (!isset($data['technicianId']) || !isset($data['note'])) {
            error_log("Missing required fields: " . json_encode($data));
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }

        $technician_id = (int)$data['technicianId'];
        if ($technician_id != $user_id) {
            error_log("Unauthorized: technicianId does not match session user_id");
            http_response_code(403);
            echo json_encode(['error' => 'Unauthorized']);
            exit;
        }

        $technician_note = trim($data['note']);
        $conn->begin_transaction();
        try {
            $stmt = $conn->prepare("UPDATE Customer_Request SET status = 'completed_technician' WHERE id = ? AND technician_id = ? AND status = 'assigned'");
            if (!$stmt) {
                error_log("Prepare failed for Customer_Request update: " . $conn->error);
                throw new Exception("Database query preparation failed: " . $conn->error);
            }
            $stmt->bind_param('ii', $request_id, $technician_id);
            if (!$stmt->execute()) {
                error_log("Execute failed for Customer_Request update: " . $stmt->error);
                throw new Exception("Database query execution failed: " . $stmt->error);
            }
            if ($stmt->affected_rows === 0) {
                error_log("Request not found or not assigned to technician: requestId=$request_id");
                throw new Exception("Request not found or not assigned to technician");
            }
            $stmt->close();

            $stmt = $conn->prepare("UPDATE Technician_Feedback SET technician_note = ? WHERE id = ?");
            if (!$stmt) {
                error_log("Prepare failed for Technician_Feedback update: " . $conn->error);
                throw new Exception("Database query preparation failed: " . $conn->error);
            }
            $stmt->bind_param('si', $technician_note, $request_id);
            if (!$stmt->execute()) {
                error_log("Execute failed for Technician_Feedback update: " . $stmt->error);
                throw new Exception("Database query execution failed: " . $stmt->error);
            }
            $stmt->close();

            $conn->commit();
            error_log("Request completed successfully: requestId=$request_id, technicianId=$technician_id");
            http_response_code(200);
            echo json_encode(['message' => 'Request completed successfully']);
        } catch (Exception $e) {
            $conn->rollback();
            error_log("Transaction failed: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'Failed to complete request: ' . $e->getMessage()]);
            exit;
        }
    } elseif ($method === 'POST' && isset($data['path']) && $data['path'] === 'send-acceptance-email' && $role === 'technician') {
        if (!isset($data['customerEmail']) || !isset($data['technicianName']) || !isset($data['technicianId']) || !isset($data['requestId']) || !isset($data['scheduledTime'])) {
            error_log("Missing required fields for email: " . json_encode($data));
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields for email']);
            exit;
        }

        $technician_id = (int)$data['technicianId'];
        if ($technician_id != $user_id) {
            error_log("Unauthorized: technicianId does not match session user_id");
            http_response_code(403);
            echo json_encode(['error' => 'Unauthorized']);
            exit;
        }

        // Email sending logic (placeholder, replace with PHPMailer if available)
        $customer_email = $data['customerEmail'];
        $technician_name = $data['technicianName'];
        $request_id = (int)$data['requestId'];
        $scheduled_time = $data['scheduledTime'];

        $subject = "Service Request #$request_id Accepted";
        $message = "Your service request #$request_id has been accepted by technician $technician_name. Scheduled time: $scheduled_time.";
        $headers = "From: no-reply@tap4service.co.nz\r\n";
        if (mail($customer_email, $subject, $message, $headers)) {
            error_log("Email sent successfully to $customer_email for requestId=$request_id");
            http_response_code(200);
            echo json_encode(['message' => 'Email sent successfully']);
        } else {
            error_log("Failed to send email to $customer_email for requestId=$request_id");
            http_response_code(500);
            echo json_encode(['error' => 'Failed to send email']);
        }
    } else {
        error_log("Invalid request: method=$method, path=" . (isset($data['path']) ? $data['path'] : 'none'));
        http_response_code(400);
        echo json_encode(['error' => 'Invalid request']);
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
?>