<?php
header('Access-Control-Allow-Origin: https://tap4service.co.nz');
header('Content-Type: application/json');

$name = $_POST['name'] ?? '';
$email = $_POST['email'] ?? '';
$password = $_POST['password'] ?? '';

if (empty($name) || empty($email) || empty($password)) {
    echo json_encode(['message' => 'UNABLE TO REGISTER CUSTOMER. All fields are required.']);
    exit;
}

// Simulate successful registration (replace with DB logic)
echo json_encode(['message' => 'Registration successful!']);
?>