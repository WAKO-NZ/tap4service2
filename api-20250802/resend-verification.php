<?php
/**
 * resend-verification.php - Version V1.5
 * - Handles resending verification email via POST /api/resend-verification.php.
 * - Sends HTML email with Tap4Service logo, 'Verify Email' button, 'Login' button, and landing page styling.
 * - Validates email, generates new token if needed.
 * - Uses correct database credentials (tapservi_deploy, WAKO123#, tapservi_tap4service).
 * - Aligned with /verify?token=... endpoint and status='verified'.
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://tap4service.co.nz');
header('Access-Control-Allow-Methods: POST, OPTIONS');
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

    if ($method !== 'POST') {
        error_log("Invalid request method: $method");
        http_response_code(400);
        echo json_encode(['error' => 'Invalid request method']);
        exit;
    }

    if (!isset($data['email'])) {
        error_log("Missing email field");
        http_response_code(400);
        echo json_encode(['error' => 'Email is required']);
        exit;
    }

    $email = trim($data['email']);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        error_log("Invalid email format: $email");
        http_response_code(400);
        echo json_encode(['error' => 'Invalid email format']);
        exit;
    }

    $stmt = $conn->prepare("SELECT id, name, status, verification_token FROM customers WHERE email = ?");
    if (!$stmt) {
        error_log("Prepare failed for email check: " . $conn->error);
        http_response_code(500);
        echo json_encode(['error' => 'Database query preparation failed: ' . $conn->error]);
        exit;
    }
    $stmt->bind_param('s', $email);
    if (!$stmt->execute()) {
        error_log("Execute failed for email check: " . $stmt->error);
        http_response_code(500);
        echo json_encode(['error' => 'Database query execution failed: ' . $stmt->error]);
        exit;
    }
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    $stmt->close();

    if (!$user) {
        error_log("Email not found: $email");
        http_response_code(404);
        echo json_encode(['error' => 'Email not found']);
        exit;
    }

    if ($user['status'] === 'verified') {
        error_log("Email already verified: $email");
        http_response_code(400);
        echo json_encode(['error' => 'Email already verified']);
        exit;
    }

    $user_id = $user['id'];
    $name = $user['name'];
    $token = $user['verification_token'] ?: bin2hex(random_bytes(16));

    if (!$user['verification_token']) {
        $stmt = $conn->prepare("UPDATE customers SET verification_token = ? WHERE id = ?");
        if (!$stmt) {
            error_log("Prepare failed for token update: " . $conn->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database query preparation failed: ' . $conn->error]);
            exit;
        }
        $stmt->bind_param('si', $token, $user_id);
        if (!$stmt->execute()) {
            error_log("Execute failed for token update: " . $stmt->error);
            http_response_code(500);
            echo json_encode(['error' => 'Database query execution failed: ' . $stmt->error]);
            exit;
        }
        $stmt->close();
    }

    // Send styled HTML verification email
    $subject = "Verify Your Email for Tap4Service";
    $message = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            background: linear-gradient(to right, #1f2937, #111827);
            color: #ffffff;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background: #1f2937;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .logo {
            display: block;
            margin: 0 auto 20px;
            max-width: 150px;
        }
        h1 {
            text-align: center;
            font-size: 24px;
            background: linear-gradient(to right, #d1d5db, #3b82f6);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }
        p {
            font-size: 16px;
            text-align: center;
            margin-bottom: 20px;
        }
        .button-container {
            text-align: center;
            margin-bottom: 20px;
        }
        .verify-button, .login-button {
            display: inline-block;
            padding: 12px 24px;
            background: linear-gradient(to right, #3b82f6, #1e40af);
            color: #ffffff;
            text-decoration: none;
            font-weight: bold;
            border-radius: 24px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            position: relative;
            overflow: hidden;
            transition: transform 0.3s, box-shadow 0.3s;
        }
        .verify-button:hover, .login-button:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(255, 255, 255, 0.5);
        }
        .verify-button::before, .login-button::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(to right, rgba(59, 130, 246, 0.3), rgba(30, 64, 175, 0.2));
            transform: skewX(-12deg);
            transition: left 0.3s;
        }
        .verify-button:hover::before, .login-button:hover::before {
            left: 100%;
        }
    </style>
</head>
<body>
    <div class="container">
        <img src="https://tap4service.co.nz/assets/logo.png" alt="Tap4Service Logo" class="logo">
        <h1>Welcome to Tap4Service, $name!</h1>
        <p>Your account has been successfully registered. Please verify your email by clicking the button below to proceed with logging in.</p>
        <div class="button-container">
            <a href="https://tap4service.co.nz/verify?token=$token" class="verify-button">Verify Email</a>
        </div>
        <p>Once verified, you can log in to your account using the button below:</p>
        <div class="button-container">
            <a href="https://tap4service.co.nz/customer-login" class="login-button">Login</a>
        </div>
    </div>
</body>
</html>
HTML;

    $headers = "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    $headers .= "From: no-reply@tap4service.co.nz\r\n";

    if (mail($email, $subject, $message, $headers)) {
        error_log("Verification email resent to $email");
        http_response_code(200);
        echo json_encode(['message' => 'Verification email sent successfully']);
    } else {
        error_log("Failed to resend verification email to $email");
        http_response_code(500);
        echo json_encode(['error' => 'Failed to send verification email']);
    }
} catch (Exception $e) {
    error_log("Exception in resend-verification.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
} finally {
    if (isset($conn) && $conn instanceof mysqli && $conn->ping()) {
        $conn->close();
    }
}
?>