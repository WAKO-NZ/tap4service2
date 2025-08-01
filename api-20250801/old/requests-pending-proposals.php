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

        error_log("Fetching pending proposals for customerId: $customerId");

        $stmt = $conn->prepare("
            SELECT pp.id, pp.request_id, pp.technician_id, t.name AS technician_name, 
                   pp.proposed_time, pp.status, pp.created_at
            FROM pending_proposals pp
            JOIN service_requests sr ON pp.request_id = sr.id
            JOIN technicians t ON pp.technician_id = t.id
            WHERE sr.customer_id = ? AND pp.status = 'pending'
        ");
        if (!$stmt) {
            error_log("Prepare failed for pending proposals fetch: " . $conn->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database query preparation failed']);
            exit;
        }
        $stmt->bind_param('i', $customerId);
        if (!$stmt->execute()) {
            error_log("Execute failed for pending proposals fetch: " . $stmt->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database query execution failed']);
            exit;
        }
        $result = $stmt->get_result();
        $proposals = [];
        while ($row = $result->fetch_assoc()) {
            $proposals[] = [
                'id' => (int) $row['id'],
                'request_id' => (int) $row['request_id'],
                'technician_id' => (int) $row['technician_id'],
                'technician_name' => $row['technician_name'],
                'proposed_time' => $row['proposed_time'] ? (new DateTime($row['proposed_time']))->format('Y-m-d H:i:s') : null,
                'status' => $row['status'],
                'created_at' => $row['created_at'] ? (new DateTime($row['created_at']))->format('Y-m-d H:i:s') : null
            ];
        }
        $stmt->close();

        error_log("Pending proposals fetched successfully for customerId: $customerId, count: " . count($proposals));
        http_response_code(200);
        echo json_encode($proposals);
    } catch (Exception $e) {
        error_log("Exception in requests-pending-proposals.php: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
    } finally {
        if (isset($conn) && $conn instanceof mysqli && $conn->ping()) {
            $conn->close();
        }
    }
    ?>