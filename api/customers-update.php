<?php
/**
 * customers-update.php - Version V1.6
 * - Handles PUT requests to /api/customers/update/:customerId.
 * - Updates name, surname, password in customers table; phone_number, alternate_phone_number, address, suburb, city, postal_code in customer_details.
 * - All fields compulsory except password (optional).
 * - Email updates not allowed.
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://tap4service.co.nz');
header('Access-Control-Allow-Methods: PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', '/home/tapservi/public_html/api/logs/custom_errors.log');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    error_log("Handling OPTIONS preflight request");
    http_response_code(200);
    exit;
}

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
    $tables = ['customers', 'customer_details'];
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

    // Verify required columns
    $customersColumns = ['id', 'name', 'surname', 'email', 'password'];
    $customerDetailsColumns = ['customer_id', 'phone_number', 'alternate_phone_number', 'address', 'suburb', 'city', 'postal_code'];
    $result = $conn->query("SHOW COLUMNS FROM customers");
    $existingCustomersColumns = [];
    while ($row = $result->fetch_assoc()) {
        $existingCustomersColumns[] = $row['Field'];
    }
    foreach ($customersColumns as $col) {
        if (!in_array($col, $existingCustomersColumns)) {
            error_log("Missing required column in customers: $col");
            http_response_code(500);
            echo json_encode(['error' => "Missing required column in customers: $col"]);
            exit;
        }
    }
    $result = $conn->query("SHOW COLUMNS FROM customer_details");
    $existingDetailsColumns = [];
    while ($row = $result->fetch_assoc()) {
        $existingDetailsColumns[] = $row['Field'];
    }
    foreach ($customerDetailsColumns as $col) {
        if (!in_array($col, $existingDetailsColumns)) {
            error_log("Missing required column in customer_details: $col");
            http_response_code(500);
            echo json_encode(['error' => "Missing required column in customer_details: $col"]);
            exit;
        }
    }
    error_log("All required columns exist in customers and customer_details");

    $method = $_SERVER['REQUEST_METHOD'];
    $path = explode('/', trim($_SERVER['REQUEST_URI'], '/'));
    $customerId = isset($path[array_search('update', $path) + 1]) ? (int)$path[array_search('update', $path) + 1] : null;
    $rawInput = file_get_contents('php://input');
    error_log("Raw input received: " . $rawInput);
    $data = json_decode($rawInput, true);
    if ($method === 'PUT' && json_last_error() !== JSON_ERROR_NONE && !empty($rawInput)) {
        error_log("JSON decode error: " . json_last_error_msg());
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON payload']);
        exit;
    }
    error_log("Request details: method=$method, customerId=$customerId");

    if ($method === 'PUT' && $customerId) {
        $name = $data['name'] ?? null;
        $surname = $data['surname'] ?? null;
        $phone_number = $data['phone_number'] ?? null;
        $alternate_phone_number = $data['alternate_phone_number'] ?? null;
        $address = $data['address'] ?? null;
        $suburb = $data['suburb'] ?? null;
        $city = $data['city'] ?? null;
        $postal_code = $data['postal_code'] ?? null;
        $password = $data['password'] ?? null;

        error_log("Processing update request: " . json_encode($data));

        if (empty($name) || empty($surname) || empty($phone_number) || empty($alternate_phone_number) || empty($address) || empty($suburb) || empty($city) || empty($postal_code)) {
            error_log("Missing required fields: name=$name, surname=$surname, phone_number=$phone_number, alternate_phone_number=$alternate_phone_number, address=$address, suburb=$suburb, city=$city, postal_code=$postal_code");
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }

        // Sanitize inputs
        $name = filter_var($name, FILTER_SANITIZE_STRING);
        $surname = filter_var($surname, FILTER_SANITIZE_STRING);
        $phone_number = filter_var($phone_number, FILTER_SANITIZE_STRING);
        $alternate_phone_number = filter_var($alternate_phone_number, FILTER_SANITIZE_STRING);
        $address = filter_var($address, FILTER_SANITIZE_STRING);
        $suburb = filter_var($suburb, FILTER_SANITIZE_STRING);
        $city = filter_var($city, FILTER_SANITIZE_STRING);
        $postal_code = filter_var($postal_code, FILTER_SANITIZE_STRING);
        $password = $password ? filter_var($password, FILTER_SANITIZE_STRING) : null;

        // Validate phone numbers
        if (!preg_match('/^\+?\d{7,15}$/', $phone_number)) {
            error_log("Invalid phone number format: $phone_number");
            http_response_code(400);
            echo json_encode(['error' => 'Invalid phone number format']);
            exit;
        }
        if (!preg_match('/^\+?\d{7,15}$/', $alternate_phone_number)) {
            error_log("Invalid alternate phone number format: $alternate_phone_number");
            http_response_code(400);
            echo json_encode(['error' => 'Invalid alternate phone number format']);
            exit;
        }

        // Validate password if provided
        if ($password && strlen($password) < 6) {
            error_log("Password too short: length=" . strlen($password));
            http_response_code(400);
            echo json_encode(['error' => 'Password must be at least 6 characters']);
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
        $stmt->bind_param('i', $customerId);
        if (!$stmt->execute()) {
            error_log("Execute failed for customer verification: " . $stmt->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database query execution failed']);
            exit;
        }
        $result = $stmt->get_result();
        if ($result->num_rows === 0) {
            error_log("Invalid customer ID: $customerId");
            http_response_code(403);
            echo json_encode(['error' => 'Unauthorized: Invalid customer ID']);
            exit;
        }
        $stmt->close();

        // Update customers table
        $updateFields = ['name = ?', 'surname = ?'];
        $params = [$name, $surname];
        $types = 'ss';
        if ($password) {
            $updateFields[] = 'password = ?';
            $params[] = password_hash($password, PASSWORD_BCRYPT);
            $types .= 's';
        }
        $params[] = $customerId;
        $types .= 'i';

        $stmt = $conn->prepare("UPDATE customers SET " . implode(', ', $updateFields) . " WHERE id = ?");
        if (!$stmt) {
            error_log("Prepare failed for customers update: " . $conn->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database query preparation failed']);
            exit;
        }
        $stmt->bind_param($types, ...$params);
        if (!$stmt->execute()) {
            error_log("Execute failed for customers update: " . $stmt->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database query execution failed']);
            exit;
        }
        $stmt->close();

        // Update customer_details table
        $stmt = $conn->prepare("UPDATE customer_details SET phone_number = ?, alternate_phone_number = ?, address = ?, suburb = ?, city = ?, postal_code = ? WHERE customer_id = ?");
        if (!$stmt) {
            error_log("Prepare failed for customer_details update: " . $conn->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database query preparation failed']);
            exit;
        }
        $stmt->bind_param('ssssssi', $phone_number, $alternate_phone_number, $address, $suburb, $city, $postal_code, $customerId);
        if (!$stmt->execute()) {
            error_log("Execute failed for customer_details update: " . $stmt->error . ", Data: " . json_encode($data));
            http_response_code(500);
            echo json_encode(['error' => 'Database query execution failed']);
            exit;
        }
        $stmt->close();

        error_log("Profile updated successfully for customerId: $customerId");
        http_response_code(200);
        echo json_encode(['message' => 'Profile updated successfully']);
        exit;
    } else {
        error_log("Invalid request: method=$method, customerId=$customerId");
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed. Use PUT to update profile.']);
        exit;
    }
} catch (Exception $e) {
    error_log("Exception in customers-update.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
} finally {
    if (isset($conn) && $conn instanceof mysqli && $conn->ping()) {
        $conn->close();
    }
}