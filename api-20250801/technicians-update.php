<?php
/**
 * technicians-update.php - Version V1.2
 * - Fixed region column name to use underscores (e.g., manawatu_whanganui).
 * - Handles PUT requests to update technician profiles in technicians and technician_details tables.
 * - Updates service_regions in technician_service_regions table.
 * - Validates regions with curly apostrophe for Hawke’s Bay.
 * - Logs errors to /home/tapservi/public_html/api/logs/custom_errors.log.
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

$servername = "localhost";
$username = "tapservi_deploy";
$password = "WAKO123#";
$dbname = "tapservi_tap4service";

$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    error_log("Connection failed: " . $conn->connect_error);
    http_response_code(500);
    echo json_encode(['error' => 'Connection failed: ' . $conn->connect_error]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$technician_id = isset($_GET['userId']) ? intval($_GET['userId']) : 0;
if ($technician_id <= 0) {
    error_log("Invalid technician ID: " . $technician_id);
    http_response_code(400);
    echo json_encode(['error' => 'Invalid technician ID']);
    exit;
}

$rawInput = file_get_contents('php://input');
error_log("Raw update input for technician ID $technician_id: " . $rawInput);
$data = json_decode($rawInput, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    error_log("JSON decode error: " . json_last_error_msg());
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON payload']);
    exit;
}

error_log("Parsed update data: " . json_encode($data));
$name = isset($data['name']) ? trim($data['name']) : null;
$address = $data['address'] ?? null;
$phone_number = $data['phone_number'] ?? null;
$pspla_number = $data['pspla_number'] ?? null;
$nzbn_number = $data['nzbn_number'] ?? null;
$public_liability_insurance = $data['public_liability_insurance'] ?? null;
$city = $data['city'] ?? null;
$postal_code = $data['postal_code'] ?? null;
$service_regions = $data['service_regions'] ?? [];

// Validate regions
$valid_regions = [
    'Auckland', 'Bay of Plenty', 'Canterbury', 'Gisborne', 'Hawke’s Bay',
    'Manawatu-Whanganui', 'Marlborough', 'Nelson', 'Northland', 'Otago',
    'Southland', 'Taranaki', 'Tasman', 'Waikato', 'Wellington', 'West Coast'
];
$invalid_regions = array_diff($service_regions, $valid_regions);
if (!empty($invalid_regions)) {
    error_log("Invalid regions provided: " . json_encode($invalid_regions));
    http_response_code(400);
    echo json_encode(['error' => 'Invalid service regions: ' . implode(', ', $invalid_regions)]);
    exit;
}

if (empty($name) && empty($service_regions) && !$address && !$phone_number && !$pspla_number && !$nzbn_number && $public_liability_insurance === null && !$city && !$postal_code) {
    error_log("No fields provided for update for technician ID: $technician_id");
    http_response_code(400);
    echo json_encode(['error' => 'No fields provided for update']);
    exit;
}

$conn->begin_transaction();
try {
    // Verify technician exists
    error_log("Checking for existing technician: ID=$technician_id");
    $stmt_check = $conn->prepare("SELECT id FROM technicians WHERE id = ?");
    $stmt_check->bind_param("i", $technician_id);
    $stmt_check->execute();
    $result = $stmt_check->get_result();
    if ($result->num_rows === 0) {
        throw new Exception("Technician not found");
    }
    $stmt_check->close();

    // Update technicians table if name is provided
    if ($name) {
        error_log("Executing UPDATE technicians: technician_id=$technician_id, name=$name");
        $stmt = $conn->prepare("UPDATE technicians SET name = ? WHERE id = ?");
        $stmt->bind_param("si", $name, $technician_id);
        if (!$stmt->execute()) {
            throw new Exception("Failed to update technicians: " . $conn->error);
        }
        $stmt->close();
    }

    // Update technician_details table
    $details_updated = false;
    if ($address || $phone_number || $pspla_number || $nzbn_number || $public_liability_insurance !== null || $city || $postal_code) {
        $public_liability_insurance_str = $public_liability_insurance === null ? null : ($public_liability_insurance ? '1' : '0');
        error_log("Executing UPSERT into technician_details: technician_id=$technician_id, address=$address");
        $stmt_details = $conn->prepare("
            INSERT INTO technician_details (technician_id, address, phone_number, pspla_number, nzbn_number, public_liability_insurance, city, postal_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                address = COALESCE(VALUES(address), address),
                phone_number = COALESCE(VALUES(phone_number), phone_number),
                pspla_number = COALESCE(VALUES(pspla_number), pspla_number),
                nzbn_number = COALESCE(VALUES(nzbn_number), nzbn_number),
                public_liability_insurance = COALESCE(VALUES(public_liability_insurance), public_liability_insurance),
                city = COALESCE(VALUES(city), city),
                postal_code = COALESCE(VALUES(postal_code), postal_code)
        ");
        $stmt_details->bind_param("isssssss", $technician_id, $address, $phone_number, $pspla_number, $nzbn_number, $public_liability_insurance_str, $city, $postal_code);
        if (!$stmt_details->execute()) {
            throw new Exception("Failed to update technician_details: " . $conn->error);
        }
        $stmt_details->close();
        $details_updated = true;
    }

    // Update technician_service_regions
    if (!empty($service_regions)) {
        // Reset all regions to 0
        error_log("Resetting all regions for technician_id=$technician_id");
        $stmt_reset = $conn->prepare("
            UPDATE technician_service_regions SET
                auckland = 0, bay_of_plenty = 0, canterbury = 0, gisborne = 0, hawkes_bay = 0,
                manawatu_whanganui = 0, marlborough = 0, nelson = 0, northland = 0, otago = 0,
                southland = 0, taranaki = 0, tasman = 0, waikato = 0, wellington = 0, west_coast = 0
            WHERE technician_id = ?
        ");
        $stmt_reset->bind_param("i", $technician_id);
        if (!$stmt_reset->execute()) {
            throw new Exception("Failed to reset technician_service_regions: " . $conn->error);
        }
        $stmt_reset->close();

        // Set selected regions to 1
        foreach ($service_regions as $region) {
            $field = strtolower(str_replace([' ', '’', '-'], ['_', '', '_'], $region));
            error_log("Executing UPDATE technician_service_regions: technician_id=$technician_id, region=$region, column=$field");
            $stmt_regions = $conn->prepare("INSERT INTO technician_service_regions (technician_id, `$field`) VALUES (?, 1) ON DUPLICATE KEY UPDATE `$field` = 1");
            $stmt_regions->bind_param("i", $technician_id);
            if (!$stmt_regions->execute()) {
                throw new Exception("Failed to update technician_service_regions for region $region: " . $conn->error);
            }
            $stmt_regions->close();
        }
    }

    $conn->commit();
    error_log("Update transaction committed for technician ID: $technician_id");
    http_response_code(200);
    echo json_encode(['message' => 'Technician profile updated successfully']);
} catch (Exception $e) {
    $conn->rollback();
    error_log("Update transaction failed for technician ID $technician_id: " . $e->getMessage());
    http_response_code($e->getMessage() === "Technician not found" ? 404 : 400);
    echo json_encode(['error' => 'Update failed: ' . $e->getMessage()]);
} finally {
    if (isset($stmt)) $stmt->close();
    $conn->close();
}
?>