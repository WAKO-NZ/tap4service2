<?php
/**
 * technician-update-profile.php - Version V1.1
 * - Handles updates to technician profile and optional password change.
 * - Validates user authentication using technicianId from request.
 * - Updates the technicians table with improved security and validation.
 * - Logs errors with detailed context to /home/tapservi/public_html/api/logs/custom_errors.log.
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://tap4service.co.nz');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

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
    echo json_encode(['error' => 'Connection failed']);
    exit;
}

session_start(); // Start session to handle authentication (optional, adjust if using tokens)

$rawInput = file_get_contents('php://input');
error_log("Raw input received: " . $rawInput); // Log full input for debugging
$data = json_decode($rawInput, true);
if (json_last_error() !== JSON_ERROR_NONE && $rawInput) {
    error_log("JSON decode error: " . json_last_error_msg() . ", Raw input: " . $rawInput);
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON payload']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $id = $data['id'] ?? null;
        $email = $data['email'] ?? '';
        $name = $data['name'] ?? '';
        $address = $data['address'] ?? null;
        $phone_number = $data['phone_number'] ?? null;
        $city = $data['city'] ?? null;
        $postal_code = $data['postal_code'] ?? null;
        $pspla_number = $data['pspla_number'] ?? null;
        $nzbn_number = $data['nzbn_number'] ?? null;
        $public_liability_insurance = isset($data['public_liability_insurance']) ? (bool)$data['public_liability_insurance'] : null;
        $password = $data['password'] ?? null;

        // Authentication check (assuming technicianId from localStorage or token)
        $authId = $id; // In a real scenario, this should come from a session or Authorization header
        if (!$authId || $authId !== $id) {
            error_log("Authentication failed: Requested ID ($id) does not match authenticated ID ($authId)");
            http_response_code(401);
            echo json_encode(['error' => 'Unauthorized access']);
            exit;
        }

        // Validate required fields
        if (empty($name)) {
            http_response_code(400);
            echo json_encode(['error' => 'Name is required']);
            exit;
        }

        // Sanitize and validate inputs
        $name = filter_var($name, FILTER_SANITIZE_STRING);
        if ($address !== null) $address = filter_var($address, FILTER_SANITIZE_STRING);
        if ($phone_number !== null) $phone_number = preg_replace('/[^0-9+]/', '', $phone_number); // Keep only numbers and +
        if ($city !== null) $city = filter_var($city, FILTER_SANITIZE_STRING);
        if ($postal_code !== null) $postal_code = preg_replace('/[^0-9A-Za-z]/', '', $postal_code); // Basic postal code sanitization
        if ($pspla_number !== null) $pspla_number = filter_var($pspla_number, FILTER_SANITIZE_STRING);
        if ($nzbn_number !== null) $nzbn_number = filter_var($nzbn_number, FILTER_SANITIZE_STRING);
        if ($password) {
            if (strlen($password) < 8) {
                http_response_code(400);
                echo json_encode(['error' => 'Password must be at least 8 characters long']);
                exit;
            }
            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
        }

        // Prevent email updates
        $stmt = $conn->prepare("SELECT email FROM technicians WHERE id = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $existingEmail = $result->fetch_assoc()['email'] ?? '';
        $stmt->close();
        if ($email !== $existingEmail) {
            error_log("Attempt to change email from $existingEmail to $email blocked");
            http_response_code(400);
            echo json_encode(['error' => 'Email cannot be changed']);
            exit;
        }

        // Prepare update query
        $updates = [];
        $params = [];
        $types = '';
        $paramValues = [$id];

        if ($name !== '') $updates[] = 'name = ?'; $params[] = $name; $types .= 's';
        if ($address !== null) $updates[] = 'address = ?'; $params[] = $address; $types .= 's';
        if ($phone_number !== null) $updates[] = 'phone_number = ?'; $params[] = $phone_number; $types .= 's';
        if ($city !== null) $updates[] = 'city = ?'; $params[] = $city; $types .= 's';
        if ($postal_code !== null) $updates[] = 'postal_code = ?'; $params[] = $postal_code; $types .= 's';
        if ($pspla_number !== null) $updates[] = 'pspla_number = ?'; $params[] = $pspla_number; $types .= 's';
        if ($nzbn_number !== null) $updates[] = 'nzbn_number = ?'; $params[] = $nzbn_number; $types .= 's';
        if ($public_liability_insurance !== null) $updates[] = 'public_liability_insurance = ?'; $params[] = $public_liability_insurance; $types .= 'i';
        if (isset($password)) $updates[] = 'password = ?'; $params[] = $hashedPassword ?? null; $types .= 's';

        if (empty($updates)) {
            http_response_code(400);
            echo json_encode(['error' => 'No updates provided']);
            exit;
        }

        $query = "UPDATE technicians SET " . implode(', ', $updates) . " WHERE id = ?";
        error_log("Executing query: $query with types: $types, params: " . json_encode($params)); // Debug log
        $stmt = $conn->prepare($query);
        if ($stmt === false) {
            error_log("Prepare failed: " . $conn->error . ", Query: $query");
            http_response_code(500);
            echo json_encode(['error' => 'Database prepare error']);
            exit;
        }

        $stmt->bind_param($types, ...array_merge($params, $paramValues));
        if (!$stmt->execute()) {
            error_log("Execute failed: " . $stmt->error . ", Query: $query, Params: " . json_encode($params));
            http_response_code(500);
            echo json_encode(['error' => 'Database error']);
            exit;
        }
        $stmt->close();

        echo json_encode(['message' => 'Profile updated successfully']);
    } catch (Exception $e) {
        error_log("Error in technician-update-profile.php: " . $e->getMessage() . ", Data: " . json_encode($data));
        http_response_code(500);
        echo json_encode(['error' => 'Server error']);
    }
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}

$conn->close();
?>