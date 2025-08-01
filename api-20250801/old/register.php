<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://tap4service.co.nz');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

$servername = "localhost";
$username = "tapservi_deploy";
$password = "WAKO123database";
$dbname = "tapservi_tap4service";

$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
  die(json_encode(['error' => 'Connection failed: ' . $conn->connect_error]));
}

$data = json_decode(file_get_contents('php://input'), true);
$email = $data['email'] ?? '';
$password = $data['password'] ?? '';
$name = $data['name'] ?? '';
$region = $data['region'] ?? '';

if ($email && $password && $name && $region) {
  $stmt = $conn->prepare("INSERT INTO customers (email, password, name, region) VALUES (?, ?, ?, ?)");
  $stmt->bind_param("ssss", $email, $password, $name, $region);
  if ($stmt->execute()) {
    echo json_encode(['message' => 'Registration successful', 'customerId' => $conn->insert_id]);
  } else {
    echo json_encode(['error' => 'Registration failed']);
  }
  $stmt->close();
} else {
  echo json_encode(['error' => 'Missing required fields']);
}

$conn->close();
?>