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
    error_log("Fetching technician details for userId: $userId");

    if (empty($userId) || !is_numeric($userId)) {
        error_log("Invalid or missing User ID: $userId");
        http_response_code(400);
        echo json_encode(['error' => 'Invalid or missing User ID']);
        exit;
    }

    // Fetch technician data
    $stmt = $conn->prepare("
        SELECT t.id, t.email, t.name, 
               td.address, td.phone_number, td.city, td.postal_code, 
               td.pspla_number, td.nzbn_number, td.public_liability_insurance
        FROM technicians t
        LEFT JOIN technician_details td ON t.id = td.technician_id
        WHERE t.id = ?
    ");
    if (!$stmt) {
        error_log("Prepare failed for technician data: " . $conn->error);
        http_response_code(500);
        echo json_encode(['error' => 'Database query preparation failed: ' . $conn->error]);
        exit;
    }
    $stmt->bind_param("i", $userId);
    if (!$stmt->execute()) {
        error_log("Execute failed for technician data: " . $stmt->error);
        http_response_code(500);
        echo json_encode(['error' => 'Database query execution failed: ' . $stmt->error]);
        exit;
    }
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($user) {
        // Fetch service regions
        $stmt = $conn->prepare("SELECT * FROM technician_service_regions WHERE technician_id = ?");
        if (!$stmt) {
            error_log("Prepare failed for regions: " . $conn->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database query preparation failed: ' . $conn->error]);
            exit;
        }
        $stmt->bind_param("i", $userId);
        if (!$stmt->execute()) {
            error_log("Execute failed for regions: " . $stmt->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database query execution failed: ' . $stmt->error]);
            exit;
        }
        $regionsResult = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $service_regions = [];
        $regionColumns = [
            'auckland' => 'Auckland',
            'bay_of_plenty' => 'Bay of Plenty',
            'canterbury' => 'Canterbury',
            'gisborne' => 'Gisborne',
            'hawkes_bay' => 'Hawke’s Bay',
            'manawatu_whanganui' => 'Manawatu-Whanganui',
            'marlborough' => 'Marlborough',
            'nelson' => 'Nelson',
            'northland' => 'Northland',
            'otago' => 'Otago',
            'southland' => 'Southland',
            'taranaki' => 'Taranaki',
            'tasman' => 'Tasman',
            'waikato' => 'Waikato',
            'wellington' => 'Wellington',
            'west_coast' => 'West Coast'
        ];
        if ($regionsResult) {
            foreach ($regionColumns as $column => $region) {
                if ($regionsResult[$column] == 1) {
                    $service_regions[] = $region;
                }
            }
        }

        error_log("Technician details fetched successfully for userId: $userId");
        http_response_code(200);
        echo json_encode([
            'valid' => true,
            'userId' => $user['id'],
            'email' => $user['email'],
            'name' => $user['name'],
            'address' => $user['address'] ?? null,
            'phone_number' => $user['phone_number'] ?? null,
            'city' => $user['city'] ?? null,
            'postal_code' => $user['postal_code'] ?? null,
            'pspla_number' => $user['pspla_number'] ?? null,
            'nzbn_number' => $user['nzbn_number'] ?? null,
            'public_liability_insurance' => $user['public_liability_insurance'] !== null ? (bool)$user['public_liability_insurance'] : null,
            'service_regions' => $service_regions
        ]);
    } else {
        error_log("Technician not found for userId: $userId");
        http_response_code(404);
        echo json_encode(['error' => 'Technician not found']);
    }

    $conn->close();
} catch (Exception $e) {
    error_log("Exception in technicians.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
    exit;
}
?>