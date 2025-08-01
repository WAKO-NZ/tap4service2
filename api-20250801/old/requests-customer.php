<?php
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: https://tap4service.co.nz');
    header('Access-Control-Allow-Methods: GET, OPTIONS');
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

        $customerId = (int) end(explode('/', trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/')));
        if (empty($customerId)) {
            error_log("Missing customerId");
            http_response_code(400);
            echo json_encode(['error' => 'Missing customerId']);
            exit;
        }

        error_log("Fetching requests for customerId: $customerId");

        $stmt = $conn->prepare("
            SELECT sr.id, sr.repair_description, sr.created_at, sr.status, sr.customer_availability_1, 
                   sr.customer_availability_2, sr.technician_scheduled_time, sr.technician_id, 
                   t.name AS technician_name, sr.technician_note, sr.payment_status, 
                   c.region, c.name AS customer_name, cd.address AS customer_address, 
                   cd.city AS customer_city, cd.postal_code AS customer_postal_code
            FROM service_requests sr
            LEFT JOIN customers c ON sr.customer_id = c.id
            LEFT JOIN customer_details cd ON sr.customer_id = cd.customer_id
            LEFT JOIN technicians t ON sr.technician_id = t.id
            WHERE sr.customer_id = ?
        ");
        if (!$stmt) {
            error_log("Prepare failed for requests fetch: " . $conn->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database query preparation failed']);
            exit;
        }
        $stmt->bind_param('i', $customerId);
        if (!$stmt->execute()) {
            error_log("Execute failed for requests fetch: " . $stmt->error);
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
                'created_at' => $row['created_at'],
                'status' => $row['status'],
                'customer_availability_1' => $row['customer_availability_1'] ? (new DateTime($row['customer_availability_1']))->format('Y-m-d H:i:s') : null,
                'customer_availability_2' => $row['customer_availability_2'] ? (new DateTime($row['customer_availability_2']))->format('Y-m-d H:i:s') : null,
                'technician_scheduled_time' => $row['technician_scheduled_time'],
                'technician_id' => $row['technician_id'] ? (int) $row['technician_id'] : null,
                'technician_name' => $row['technician_name'],
                'technician_note' => $row['technician_note'],
                'payment_status' => $row['payment_status'],
                'region' => $row['region'],
                'customer_name' => $row['customer_name'],
                'customer_address' => $row['customer_address'],
                'customer_city' => $row['customer_city'],
                'customer_postal_code' => $row['customer_postal_code']
            ];
        }
        $stmt->close();

        error_log("Requests fetched successfully for customerId: $customerId, count: " . count($requests));
        http_response_code(200);
        echo json_encode($requests);
    } catch (Exception $e) {
        error_log("Exception in requests-customer.php: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
    } finally {
        if (isset($conn) && $conn instanceof mysqli && $conn->ping()) {
            $conn->close();
        }
    }
    ?>