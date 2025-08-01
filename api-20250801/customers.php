<?php
/**
 * customers.php - Version V1.4
 * - Handles GET requests to /api/customers/:customerId.
 * - Fetches name, surname, email from customers; phone_number, alternate_phone_number, address, suburb, city, postal_code from customer_details.
 * - Enhanced logging for debugging.
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://tap4service.co.nz');
header('Access-Control-Allow-Methods: GET, OPTIONS');
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

    $method = $_SERVER['REQUEST_METHOD'];
    $headers = getallheaders();
    error_log("Request headers: " . json_encode($headers));
    $path = explode('/', trim($_SERVER['REQUEST_URI'], '/'));
    $customerId = isset($path[array_search('customers', $path) + 1]) ? (int)$path[array_search('customers', $path) + 1] : null;
    error_log("Request details: method=$method, customerId=$customerId, URI=" . $_SERVER['REQUEST_URI']);

    if ($method === 'GET' && $customerId) {
        // Fetch from customers
        $stmt = $conn->prepare("SELECT name, surname, email FROM customers WHERE id = ?");
        if (!$stmt) {
            error_log("Prepare failed for customers fetch: " . $conn->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database query preparation failed']);
            exit;
        }
        $stmt->bind_param('i', $customerId);
        if (!$stmt->execute()) {
            error_log("Execute failed for customers fetch: " . $stmt->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database query execution failed']);
            exit;
        }
        $result = $stmt->get_result();
        if ($result->num_rows === 0) {
            error_log("Invalid customer ID: $customerId");
            http_response_code(404);
            echo json_encode(['error' => 'Customer not found']);
            exit;
        }
        $customerData = $result->fetch_assoc();
        $stmt->close();

        // Fetch from customer_details
        $stmt = $conn->prepare("SELECT phone_number, alternate_phone_number, address, suburb, city, postal_code FROM customer_details WHERE customer_id = ?");
        if (!$stmt) {
            error_log("Prepare failed for customer_details fetch: " . $conn->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database query preparation failed']);
            exit;
        }
        $stmt->bind_param('i', $customerId);
        if (!$stmt->execute()) {
            error_log("Execute failed for customer_details fetch: " . $stmt->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database query execution failed']);
            exit;
        }
        $result = $stmt->get_result();
        $detailsData = $result->num_rows > 0 ? $result->fetch_assoc() : [
            'phone_number' => '',
            'alternate_phone_number' => '',
            'address' => '',
            'suburb' => '',
            'city' => '',
            'postal_code' => ''
        ];
        $stmt->close();

        $response = array_merge($customerData, $detailsData);
        error_log("Customer details fetched successfully for customerId: $customerId, Response: " . json_encode($response));
        http_response_code(200);
        echo json_encode($response);
        exit;
    } else {
        error_log("Invalid request: method=$method, customerId=$customerId");
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed. Use GET to fetch customer profile.']);
        exit;
    }
} catch (Exception $e) {
    error_log("Exception in customers.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
} finally {
    if (isset($conn) && $conn instanceof mysqli && $conn->ping()) {
        $conn->close();
    }
}