-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Jul 26, 2025 at 09:53 AM
-- Server version: 11.4.7-MariaDB
-- PHP Version: 8.3.23

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `tapservi_tap4service`
--

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `region` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_details`
--

CREATE TABLE `customer_details` (
  `customer_id` int(11) NOT NULL,
  `address` varchar(255) DEFAULT NULL,
  `phone_number` varchar(50) DEFAULT NULL,
  `alternate_phone_number` varchar(50) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `postal_code` varchar(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pending_proposals`
--

CREATE TABLE `pending_proposals` (
  `id` int(11) NOT NULL,
  `request_id` int(11) NOT NULL,
  `technician_id` int(11) NOT NULL,
  `proposed_time` datetime NOT NULL,
  `status` enum('pending','approved','declined') DEFAULT 'pending',
  `created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `service_requests`
--

CREATE TABLE `service_requests` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `repair_description` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `status` enum('pending','assigned','completed_technician','completed','cancelled') DEFAULT 'pending',
  `customer_availability_1` datetime NOT NULL,
  `customer_availability_2` datetime DEFAULT NULL,
  `technician_id` int(11) DEFAULT NULL,
  `technician_scheduled_time` datetime DEFAULT NULL,
  `payment_id` varchar(255) DEFAULT NULL,
  `payment_status` enum('pending','authorized','captured') DEFAULT 'pending',
  `region` varchar(255) NOT NULL,
  `technician_note` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `technicians`
--

CREATE TABLE `technicians` (
  `id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `is_available` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `technicians_details`
--

CREATE TABLE `technicians_details` (
  `id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `address` varchar(255) DEFAULT NULL,
  `phone_number` varchar(20) DEFAULT NULL,
  `pspla_number` varchar(20) DEFAULT NULL,
  `nzbn_number` varchar(20) DEFAULT NULL,
  `public_liability_insurance` tinyint(1) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `postal_code` varchar(10) DEFAULT NULL,
  `service_regions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`service_regions`)),
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `technicians_details`
--

INSERT INTO `technicians_details` (`id`, `email`, `password`, `name`, `address`, `phone_number`, `pspla_number`, `nzbn_number`, `public_liability_insurance`, `city`, `postal_code`, `service_regions`, `created_at`) VALUES
(2, 'waynebosch3@gmail.com', 'Wayne02#', 'Wayne Bosch', '81 Aberfeldy Avenue', '+64212092884', '111', '1111', 1, 'Auckland', '2010', '[\"Auckland\",\"Canterbury\",\"Hawke\\u2019s Bay\",\"Marlborough\",\"Northland\",\"Southland\",\"Bay of Plenty\",\"Gisborne\",\"Manawatu-Whanganui\",\"Nelson\",\"Otago\",\"Taranaki\",\"Waikato\",\"West Coast\",\"Tasman\",\"Wellington\"]', '2025-07-19 01:28:03'),
(3, 'waynebosch2@gmail.com', '4GJBKPWjJaLPJzu', 'Wayne Bosch', '432 Rosebank Road', '+6421581230', '444', '444', 1, 'Auckland', '0126', '[\"Auckland\",\"Canterbury\",\"Hawke\\u2019s Bay\",\"Marlborough\",\"Northland\",\"Southland\",\"Tasman\",\"Wellington\"]', '2025-07-24 07:09:33');

-- --------------------------------------------------------

--
-- Table structure for table `technician_details`
--

CREATE TABLE `technician_details` (
  `id` int(11) NOT NULL,
  `technician_id` int(11) NOT NULL,
  `address` varchar(255) DEFAULT NULL,
  `phone_number` varchar(20) DEFAULT NULL,
  `pspla_number` varchar(20) DEFAULT NULL,
  `nzbn_number` varchar(20) DEFAULT NULL,
  `public_liability_insurance` tinyint(1) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `postal_code` varchar(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `technician_service_regions`
--

CREATE TABLE `technician_service_regions` (
  `technician_id` int(11) NOT NULL,
  `auckland` tinyint(1) DEFAULT NULL,
  `bay_of_plenty` tinyint(1) DEFAULT NULL,
  `canterbury` tinyint(1) DEFAULT NULL,
  `gisborne` tinyint(1) DEFAULT NULL,
  `hawkes_bay` tinyint(1) DEFAULT NULL,
  `manawatu_whanganui` tinyint(1) DEFAULT NULL,
  `marlborough` tinyint(1) DEFAULT NULL,
  `nelson` tinyint(1) DEFAULT NULL,
  `northland` tinyint(1) DEFAULT NULL,
  `otago` tinyint(1) DEFAULT NULL,
  `southland` tinyint(1) DEFAULT NULL,
  `taranaki` tinyint(1) DEFAULT NULL,
  `tasman` tinyint(1) DEFAULT NULL,
  `waikato` tinyint(1) DEFAULT NULL,
  `wellington` tinyint(1) DEFAULT NULL,
  `west_coast` tinyint(1) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `customer_details`
--
ALTER TABLE `customer_details`
  ADD PRIMARY KEY (`customer_id`);

--
-- Indexes for table `pending_proposals`
--
ALTER TABLE `pending_proposals`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_pending_proposals_request` (`request_id`),
  ADD KEY `fk_pending_proposals_technician` (`technician_id`);

--
-- Indexes for table `service_requests`
--
ALTER TABLE `service_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_service_requests_customer` (`customer_id`),
  ADD KEY `fk_service_requests_technician` (`technician_id`);

--
-- Indexes for table `technicians`
--
ALTER TABLE `technicians`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `technicians_details`
--
ALTER TABLE `technicians_details`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `technician_details`
--
ALTER TABLE `technician_details`
  ADD PRIMARY KEY (`id`),
  ADD KEY `technician_id` (`technician_id`);

--
-- Indexes for table `technician_service_regions`
--
ALTER TABLE `technician_service_regions`
  ADD PRIMARY KEY (`technician_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `pending_proposals`
--
ALTER TABLE `pending_proposals`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `service_requests`
--
ALTER TABLE `service_requests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `technicians`
--
ALTER TABLE `technicians`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `technicians_details`
--
ALTER TABLE `technicians_details`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `technician_details`
--
ALTER TABLE `technician_details`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `customer_details`
--
ALTER TABLE `customer_details`
  ADD CONSTRAINT `customer_details_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  ADD CONSTRAINT `fk_customer_details_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`);

--
-- Constraints for table `pending_proposals`
--
ALTER TABLE `pending_proposals`
  ADD CONSTRAINT `fk_pending_proposals_request` FOREIGN KEY (`request_id`) REFERENCES `service_requests` (`id`),
  ADD CONSTRAINT `fk_pending_proposals_technician` FOREIGN KEY (`technician_id`) REFERENCES `technicians` (`id`),
  ADD CONSTRAINT `pending_proposals_ibfk_1` FOREIGN KEY (`request_id`) REFERENCES `service_requests` (`id`),
  ADD CONSTRAINT `pending_proposals_ibfk_2` FOREIGN KEY (`technician_id`) REFERENCES `technicians` (`id`);

--
-- Constraints for table `service_requests`
--
ALTER TABLE `service_requests`
  ADD CONSTRAINT `fk_service_requests_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  ADD CONSTRAINT `fk_service_requests_technician` FOREIGN KEY (`technician_id`) REFERENCES `technicians` (`id`),
  ADD CONSTRAINT `service_requests_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  ADD CONSTRAINT `service_requests_ibfk_2` FOREIGN KEY (`technician_id`) REFERENCES `technicians` (`id`);

--
-- Constraints for table `technician_details`
--
ALTER TABLE `technician_details`
  ADD CONSTRAINT `technician_details_ibfk_1` FOREIGN KEY (`technician_id`) REFERENCES `technicians` (`id`);

--
-- Constraints for table `technician_service_regions`
--
ALTER TABLE `technician_service_regions`
  ADD CONSTRAINT `technician_service_regions_ibfk_1` FOREIGN KEY (`technician_id`) REFERENCES `technicians` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
