<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// DB Connection (update credentials)
try {
    $pdo = new PDO('mysql:host=localhost;dbname=tapservi_tap4service;charset=utf8mb4', 'your_username', 'your_password');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    error_log(date('[d-M-Y H:i:s e]') . " Database connection successful");
} catch (PDOException $e) {
    error_log(date('[d-M-Y H:i:s e]') . " Database connection failed: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

// Table checks
$tables = ['service_requests', 'customers', 'technicians', 'technician_service_regions'];
foreach ($tables as $table) {
    $stmt = $pdo->query("SHOW TABLES LIKE '$table'");
    if ($stmt->rowCount() > 0) {
        error_log(date('[d-M-Y H:i:s e]') . " Table $table exists");
    } else {
        http_response_code(500);
        echo json_encode(['error' => "Table $table does not exist"]);
        exit;
    }
}

// Column checks
$columns = ['id', 'customer_id', 'repair_description', 'created_at', 'status', 'customer_availability_1', 'customer_availability_2', 'technician_id', 'technician_scheduled_time', 'region'];
$stmt = $pdo->query("SHOW COLUMNS FROM service_requests");
$existingCols = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'Field');
if (array_diff($columns, $existingCols)) {
    http_response_code(500);
    echo json_encode(['error' => 'Missing columns in service_requests']);
    exit;
}
error_log(date('[d-M-Y H:i:s e]') . " All required columns exist in service_requests");

// Parse path
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$basePath = '/api/requests';
$path = substr($uri, strlen($basePath));
$path = ltrim($path, '/');
$request = array_filter(explode('/', $path));
$method = $_SERVER['REQUEST_METHOD'];

// Raw input
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true) ?? [];
error_log(date('[d-M-Y H:i:s e]') . " Raw input received: " . $rawInput);
error_log(date('[d-M-Y H:i:s e]') . " Request details: method=$method, path=$path, request=" . json_encode($request));

// Handlers
if ($method === 'POST' && $path === '') {
    // Create request
    if (!isset($data['customer_id'], $data['repair_description'], $data['availability_1'], $data['region'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields']);
        exit;
    }
    try {
        $stmt = $pdo->prepare("
            INSERT INTO service_requests (customer_id, repair_description, created_at, status, customer_availability_1, customer_availability_2, region)
            VALUES (:customer_id, :repair_description, NOW(), 'pending', :availability_1, :availability_2, :region)
        ");
        $stmt->execute([
            'customer_id' => $data['customer_id'],
            'repair_description' => $data['repair_description'],
            'availability_1' => $data['availability_1'],
            'availability_2' => $data['availability_2'] ?? null,
            'region' => $data['region']
        ]);
        $id = $pdo->lastInsertId();
        error_log(date('[d-M-Y H:i:s e]') . " New request created successfully, ID: $id");
        http_response_code(201);
        echo json_encode(['success' => true, 'id' => $id]);
    } catch (Exception $e) {
        error_log('Error creating request: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error creating request']);
    }
    exit;
} elseif ($method === 'GET' && $request[0] === 'customer' && isset($request[1])) {
    $customerId = (int)$request[1];
    try {
        $stmt = $pdo->prepare("
            SELECT sr.id, sr.repair_description, sr.created_at, sr.status, sr.customer_availability_1, sr.customer_availability_2,
                   sr.technician_scheduled_time, sr.technician_id, t.name AS technician_name, sr.region
            FROM service_requests sr
            LEFT JOIN technicians t ON sr.technician_id = t.id
            WHERE sr.customer_id = :customerId
            ORDER BY sr.created_at DESC
        ");
        $stmt->execute(['customerId' => $customerId]);
        $requests = $stmt->fetchAll(PDO::FETCH_ASSOC);
        error_log(date('[d-M-Y H:i:s e]') . " Requests fetched successfully for customerId: $customerId, count: " . count($requests));
        echo json_encode($requests);
    } catch (Exception $e) {
        error_log('Error fetching customer requests: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error fetching data']);
    }
    exit;
} elseif ($method === 'GET' && $request[0] === 'technician' && isset($request[1])) {
    $technicianId = (int)$request[1];
    try {
        $stmt = $pdo->prepare("
            SELECT sr.id, sr.repair_description, sr.created_at, sr.status, sr.customer_availability_1, sr.customer_availability_2,
                   sr.technician_scheduled_time, sr.region, c.name AS customer_name
            FROM service_requests sr
            LEFT JOIN customers c ON sr.customer_id = c.id
            WHERE sr.technician_id = :technicianId
            ORDER BY sr.created_at DESC
        ");
        $stmt->execute(['technicianId' => $technicianId]);
        $requests = $stmt->fetchAll(PDO::FETCH_ASSOC);
        error_log(date('[d-M-Y H:i:s e]') . " Requests fetched successfully for technicianId: $technicianId, count: " . count($requests));
        echo json_encode($requests);
    } catch (Exception $e) {
        error_log('Error fetching technician requests: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error fetching data']);
    }
    exit;
} elseif ($method === 'GET' && $request[0] === 'available') {
    $technicianId = (int)($_GET['technicianId'] ?? 0);
    if (!$technicianId) {
        http_response_code(400);
        echo json_encode(['error' => 'Technician ID required']);
        exit;
    }
    try {
        $stmt = $pdo->prepare("SELECT * FROM technician_service_regions WHERE technician_id = :technicianId");
        $stmt->execute(['technicianId' => $technicianId]);
        $regions = $stmt->fetch(PDO::FETCH_ASSOC);
        $regionConditions = [];
        foreach ($regions as $key => $value) {
            if ($value && $key !== 'technician_id') {
                $regionName = str_replace('_', ' ', ucwords($key));
                $regionConditions[] = "sr.region = '$regionName'";
            }
        }
        $regionWhere = empty($regionConditions) ? '1=0' : '(' . implode(' OR ', $regionConditions) . ')';
        $stmt = $pdo->prepare("
            SELECT sr.id, sr.repair_description, sr.created_at, sr.customer_availability_1, sr.customer_availability_2, sr.region
            FROM service_requests sr
            WHERE sr.status = 'pending' AND sr.technician_id IS NULL AND $regionWhere
            ORDER BY sr.created_at ASC
        ");
        $stmt->execute();
        $requests = $stmt->fetchAll(PDO::FETCH_ASSOC);
        error_log(date('[d-M-Y H:i:s e]') . " Available requests fetched successfully for technicianId: $technicianId, count: " . count($requests));
        echo json_encode($requests);
    } catch (Exception $e) {
        error_log('Error fetching available requests: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error fetching data']);
    }
    exit;
} elseif ($method === 'PUT' && $request[0] === 'reschedule' && isset($request[1])) {
    $requestId = (int)$request[1];
    if (!isset($data['customerId'], $data['availability_1'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields']);
        exit;
    }
    try {
        $stmt = $pdo->prepare("
            UPDATE service_requests
            SET customer_availability_1 = :availability_1, customer_availability_2 = :availability_2,
                technician_id = NULL, technician_scheduled_time = NULL, status = 'pending'
            WHERE id = :id AND customer_id = :customerId AND (status = 'pending' OR status = 'assigned')
        ");
        $stmt->execute([
            'availability_1' => $data['availability_1'],
            'availability_2' => $data['availability_2'] ?? null,
            'id' => $requestId,
            'customerId' => $data['customerId']
        ]);
        if ($stmt->rowCount() > 0) {
            error_log(date('[d-M-Y H:i:s e]') . " Request rescheduled successfully, ID: $requestId");
            echo json_encode(['success' => true]);
        } else {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid request or status']);
        }
    } catch (Exception $e) {
        error_log('Error rescheduling: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error rescheduling']);
    }
    exit;
} elseif ($method === 'DELETE' && isset($request[0]) && is_numeric($request[0])) {
    $requestId = (int)$request[0];
    if (!isset($data['customerId'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing customerId']);
        exit;
    }
    try {
        $stmt = $pdo->prepare("UPDATE service_requests SET status = 'cancelled' WHERE id = :id AND customer_id = :customerId");
        $stmt->execute(['id' => $requestId, 'customerId' => $data['customerId']]);
        if ($stmt->rowCount() > 0) {
            error_log(date('[d-M-Y H:i:s e]') . " Request cancelled successfully, ID: $requestId");
            echo json_encode(['success' => true]);
        } else {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid request']);
        }
    } catch (Exception $e) {
        error_log('Error cancelling: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error cancelling']);
    }
    exit;
} elseif ($method === 'PUT' && $request[0] === 'confirm-completion' && isset($request[1])) {
    $requestId = (int)$request[1];
    if (!isset($data['customerId'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing customerId']);
        exit;
    }
    try {
        $stmt = $pdo->prepare("UPDATE service_requests SET status = 'completed' WHERE id = :id AND customer_id = :customerId AND status = 'completed_technician'");
        $stmt->execute(['id' => $requestId, 'customerId' => $data['customerId']]);
        if ($stmt->rowCount() > 0) {
            error_log(date('[d-M-Y H:i:s e]') . " Completion confirmed, ID: $requestId");
            echo json_encode(['success' => true]);
        } else {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid request or status']);
        }
    } catch (Exception $e) {
        error_log('Error confirming completion: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error confirming completion']);
    }
    exit;
} elseif ($method === 'GET' && $request[0] === 'customers' && isset($request[1])) {
    $customerId = (int)$request[1];
    try {
        $stmt = $pdo->prepare("SELECT id FROM customers WHERE id = :id");
        $stmt->execute(['id' => $customerId]);
        $customer = $stmt->fetch(PDO::FETCH_ASSOC);
        echo json_encode(['valid' => !!$customer]);
    } catch (Exception $e) {
        error_log('Error validating customer: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error validating session']);
    }
    exit;
} else {
    error_log(date('[d-M-Y H:i:s e]') . " Invalid request: method=$method, path=$path");
    http_response_code(404);
    echo json_encode(['error' => 'Endpoint not found']);
    exit;
}
?>