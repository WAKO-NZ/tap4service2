<?php
/**
 * verify.php - Version V1.9
 * - Handles email verification via GET /verify?token=... for customers.
 * - Updates status to 'verified' and clears verification_token.
 * - Sends confirmation email with 'You are now registered and can login', logo, and 'Login' button styled like landing page.
 * - Redirects to /customer-login with success message.
 * - Logs errors to /home/tapservi/public_html/api/logs/custom_errors.log.
 * - Enhanced logging for debugging 404 and token issues.
 * - Aligned with tapservi_tap4service (8).sql (status='verified').
 */
header('Content-Type: text/html; charset=UTF-8');

ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', '/home/tapservi/public_html/api/logs/custom_errors.log');

session_start();
error_log("Session start: " . json_encode($_SESSION));
error_log("Request URI: " . $_SERVER['REQUEST_URI']);
error_log("Script name: " . $_SERVER['SCRIPT_NAME']);
error_log("Query string: " . $_SERVER['QUERY_STRING']);

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
        echo "<h1>500 Internal Server Error</h1><p>Database connection failed. Please try again later.</p>";
        exit;
    }
    error_log("Database connection successful");

    if ($_SERVER['REQUEST_METHOD'] !== 'GET' || !isset($_GET['token'])) {
        error_log("Invalid request: method=" . $_SERVER['REQUEST_METHOD'] . ", token=" . (isset($_GET['token']) ? $_GET['token'] : 'not provided'));
        http_response_code(400);
        echo "<h1>400 Bad Request</h1><p>Invalid or missing verification token.</p>";
        exit;
    }

    $token = trim($_GET['token']);
    error_log("Verifying token: $token");

    $stmt = $conn->prepare("SELECT id, email, name, status FROM customers WHERE verification_token = ?");
    if (!$stmt) {
        error_log("Prepare failed for token check: " . $conn->error);
        http_response_code(500);
        echo "<h1>500 Internal Server Error</h1><p>Database query preparation failed.</p>";
        exit;
    }
    $stmt->bind_param('s', $token);
    if (!$stmt->execute()) {
        error_log("Execute failed for token check: " . $stmt->error);
        http_response_code(500);
        echo "<h1>500 Internal Server Error</h1><p>Database query execution failed.</p>";
        exit;
    }
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    $stmt->close();

    if (!$user) {
        error_log("Invalid or expired token: $token");
        http_response_code(400);
        echo "<h1>400 Bad Request</h1><p>Invalid or expired verification token.</p>";
        exit;
    }

    if ($user['status'] !== 'pending') {
        error_log("Account not in pending status for token: $token, status: " . $user['status']);
        http_response_code(400);
        echo "<h1>400 Bad Request</h1><p>Account is not pending verification.</p>";
        exit;
    }

    $user_id = $user['id'];
    $name = $user['name'];
    $email = $user['email'];
    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare("UPDATE customers SET status = 'verified', verification_token = NULL WHERE id = ?");
        if (!$stmt) {
            error_log("Prepare failed for status update: " . $conn->error);
            throw new Exception("Database query preparation failed: " . $conn->error);
        }
        $stmt->bind_param('i', $user_id);
        if (!$stmt->execute()) {
            error_log("Execute failed for status update: " . $stmt->error);
            throw new Exception("Database query execution failed: " . $stmt->error);
        }
        $affected_rows = $stmt->affected_rows;
        $stmt->close();

        if ($affected_rows === 0) {
            error_log("No rows updated for user ID: $user_id");
            throw new Exception("Failed to update verification status");
        }

        $conn->commit();
        error_log("Email verified successfully for user ID: $user_id");

        // Send confirmation email
        $subject = "Your Tap4Service Account is Verified";
        $message = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Account Verified</title>
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
        }
        .login-button {
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
        .login-button:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(255, 255, 255, 0.5);
        }
        .login-button::before {
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
        .login-button:hover::before {
            left: 100%;
        }
    </style>
</head>
<body>
    <div class="container">
        <img src="https://tap4service.co.nz/assets/logo.png" alt="Tap4Service Logo" class="logo">
        <h1>Account Verified!</h1>
        <p>Dear $name, you are now registered and can login.</p>
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
            error_log("Confirmation email sent to $email");
        } else {
            error_log("Failed to send confirmation email to $email");
            // Note: Do not throw exception here to avoid rolling back the transaction
        }

        header('Location: https://tap4service.co.nz/customer-login?message=Email+verified+successfully');
        exit;
    } catch (Exception $e) {
        $conn->rollback();
        error_log("Transaction failed: " . $e->getMessage());
        http_response_code(400);
        echo "<h1>400 Bad Request</h1><p>Failed to verify email: " . htmlspecialchars($e->getMessage()) . "</p>";
        exit;
    }
} catch (Exception $e) {
    error_log("Exception in verify.php: " . $e->getMessage());
    http_response_code(500);
    echo "<h1>500 Internal Server Error</h1><p>Server error: " . htmlspecialchars($e->getMessage()) . "</p>";
} finally {
    if (isset($conn) && $conn instanceof mysqli && $conn->ping()) {
        $conn->close();
    }
}
?>