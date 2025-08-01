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

$id = isset($_GET['id']) ? $_GET['id'] : '';

if ($id) {
  $stmt = $conn->prepare("SELECT * FROM technicians WHERE id = ?");
  $stmt->bind_param("i", $id);
  $stmt->execute();
  $result = $stmt->get_result();
  $row = $result->fetch_assoc();
  $stmt->close();

  if ($row) {
    echo json_encode($row);
  } else {
    echo json_encode(['error' => 'Technician not found']);
  }
} else {
  echo json_encode(['error' => 'ID parameter required']);
}

$conn->close();
?>