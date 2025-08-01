<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://tap4service.co.nz');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

$servername = "localhost";
$username = "tapservi_deploy";
$password = "WAKO123database";
$dbname = "tapservi_tap4service";

$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
  die(json_encode(['error' => 'Connection failed: ' . $conn->connect_error]));
}

$result = $conn->query("SELECT 1 + 1 AS solution");
$row = $result->fetch_assoc();
$conn->close();

echo json_encode(['message' => 'Backend is working!', 'result' => $row['solution']]);
?>