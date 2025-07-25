/**
 * index.js - Version V5.324
 * - Removes Stripe, uses mock payment IDs for testing without payment confirmation.
 * - Fixes 400 error in /api/requests with refined validation and enhanced logging.
 * - Aligns with tap4service database schema (customers, service_requests, etc.).
 * - Retains pending-proposals, propose, confirm-proposal endpoints.
 * - Supports persistent login, 20-second polling, WebSocket updates.
 * - Uses DD/MM/YYYY HH:MM:SS in Pacific/Auckland for timestamps.
 */
const express = require('express');
const http = require('http');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const WebSocket = require('ws');
const moment = require('moment-timezone');
require('dotenv').config();

// Create Express app and HTTP server with WebSocket
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware setup
app.use(express.json());
app.use(cors());
app.use(express.static('frontend/public')); // Serve static files

// Root route
app.get('/', (req, res) => {
  res.send('WebSocket Server is running');
});

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'your_password',
  database: process.env.DB_NAME || 'tap4service'
};

// Validate environment variables
if (!dbConfig.host || !dbConfig.user || !dbConfig.database) {
  console.error('Missing required environment variables in .env file: DB_HOST, DB_USER, DB_NAME');
  process.exit(1);
}

let db;

// Initialize database connection
async function initializeDb() {
  try {
    db = await mysql.createPool(dbConfig); // Use connection pool
    console.log('Connected to MySQL database');
  } catch (err) {
    console.error('Error connecting to MySQL:', err);
    process.exit(1);
  }
}

initializeDb();

// Helper function to generate mock payment ID
const generateMockPaymentId = (customerId) => {
  const timestamp = Date.now();
  return `bnzpay_mock_${timestamp}_${customerId}`;
};

// Helper function to validate future dates
const isValidFutureDate = (dateTimeStr) => {
  if (!dateTimeStr) return true;
  const date = moment.tz(dateTimeStr, 'DD/MM/YYYY HH:mm:ss', 'Pacific/Auckland');
  if (!date.isValid()) {
    console.error(`Invalid date format: ${dateTimeStr}`);
    return false;
  }
  const now = moment.tz('Pacific/Auckland');
  return date.isAfter(now.startOf('day'));
};

// Helper function to convert to MySQL DATETIME
const toMySQLDateTime = (dateStr) => {
  const date = moment.tz(dateStr, 'DD/MM/YYYY HH:mm:ss', 'Pacific/Auckland');
  if (!date.isValid()) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  return date.format('YYYY-MM-DD HH:mm:ss');
};

// Helper function to format MySQL DATETIME to DD/MM/YYYY HH:mm:ss
const formatToClientDateTime = (dateStr) => {
  if (!dateStr) return null;
  return moment(dateStr).tz('Pacific/Auckland').format('DD/MM/YYYY HH:mm:ss');
};

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected. Total clients:', wss.clients.size);
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        console.log('Pong sent to client');
      } else if (data.type === 'subscribe') {
        ws.technicianId = data.technicianId || null;
        ws.customerId = data.customerId || null;
        console.log(`Subscribed ${ws.technicianId ? `technician ID: ${ws.technicianId}` : `customer ID: ${ws.customerId}`}`);
      }
    } catch (err) {
      console.error('WebSocket message parse error:', err);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected. Total clients:', wss.clients.size);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Broadcast update or new job
const broadcastUpdate = async (requestId, type = 'update') => {
  let connection;
  try {
    connection = await db.getConnection();
    const [rows] = await connection.query(`
      SELECT sr.*, c.name AS customer_name, cd.address AS customer_address, cd.city AS customer_city, cd.postal_code AS customer_postal_code,
             t.name AS technician_name
      FROM service_requests sr
      LEFT JOIN customers c ON sr.customer_id = c.id
      LEFT JOIN customer_details cd ON c.id = cd.customer_id
      LEFT JOIN technicians t ON sr.technician_id = t.id
      WHERE sr.id = ?
    `, [requestId]);

    if (rows.length === 0) return;

    const request = rows[0];
    const message = {
      type,
      requestId: request.id,
      status: request.status,
      technician_id: request.technician_id,
      technician_scheduled_time: formatToClientDateTime(request.technician_scheduled_time),
      customer_availability_1: formatToClientDateTime(request.customer_availability_1),
      customer_availability_2: formatToClientDateTime(request.customer_availability_2),
      repair_description: request.repair_description,
      created_at: formatToClientDateTime(request.created_at),
      customer_name: request.customer_name,
      customer_address: request.customer_address,
      customer_city: request.customer_city,
      customer_postal_code: request.customer_postal_code,
      technician_note: request.technician_note,
      technician_name: request.technician_name
    };

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && (client.technicianId || client.customerId)) {
        if (type === 'new_job' && client.technicianId && request.status === 'pending' && !request.technician_id) {
          client.send(JSON.stringify(message));
        } else if (type === 'update' && (client.customerId === String(request.customer_id) || client.technicianId === String(request.technician_id))) {
          client.send(JSON.stringify(message));
        }
      }
    });
  } catch (err) {
    console.error('Error broadcasting update:', err);
  } finally {
    if (connection) connection.release();
  }
};

// Broadcast proposal
const broadcastProposal = async (proposal, requestId) => {
  let connection;
  try {
    connection = await db.getConnection();
    const [requestRows] = await connection.query(`
      SELECT sr.*, c.name AS customer_name, cd.address AS customer_address, cd.city AS customer_city, cd.postal_code AS customer_postal_code,
             t.name AS technician_name
      FROM service_requests sr
      LEFT JOIN customers c ON sr.customer_id = c.id
      LEFT JOIN customer_details cd ON c.id = cd.customer_id
      LEFT JOIN technicians t ON sr.technician_id = t.id
      WHERE sr.id = ?
    `, [requestId]);
    const [technicianRows] = await connection.query('SELECT name FROM technicians WHERE id = ?', [proposal.technician_id]);
    if (requestRows.length === 0 || technicianRows.length === 0) return;

    const request = requestRows[0];
    const technician = technicianRows[0];
    const message = {
      type: 'proposal',
      requestId: request.id,
      technician_id: proposal.technician_id,
      technician_name: technician.name,
      proposed_time: formatToClientDateTime(proposal.proposed_time),
      proposal_status: proposal.status,
      repair_description: request.repair_description,
      created_at: formatToClientDateTime(request.created_at),
      customer_name: request.customer_name,
      customer_address: request.customer_address,
      customer_city: request.customer_city,
      customer_postal_code: request.customer_postal_code,
      technician_note: request.technician_note
    };

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        if (client.customerId === String(request.customer_id) || (client.technicianId === String(proposal.technician_id) && proposal.status !== 'pending')) {
          client.send(JSON.stringify(message));
        }
      }
    });
  } catch (err) {
    console.error('Error broadcasting proposal:', err);
  } finally {
    if (connection) connection.release();
  }
};

// Customer registration
app.post('/api/customers/register', async (req, res) => {
  const { email, password, name, address, phone_number, alternate_phone_number, city, postal_code, region } = req.body;
  if (!email || !password || !name || !region || region.trim() === '') {
    return res.status(400).json({ error: 'Email, password, name, and non-empty region are required' });
  }
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [existing] = await connection.query('SELECT * FROM customers WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await connection.query(
      'INSERT INTO customers (email, password, name, region) VALUES (?, ?, ?, ?)',
      [email, hashedPassword, name, region.trim()]
    );
    const customerId = result.insertId;

    if (address || phone_number || alternate_phone_number || city || postal_code) {
      await connection.query(
        'INSERT INTO customer_details (customer_id, address, phone_number, alternate_phone_number, city, postal_code) VALUES (?, ?, ?, ?, ?, ?)',
        [customerId, address || null, phone_number || null, alternate_phone_number || null, city || null, postal_code || null]
      );
    }

    await connection.commit();
    res.status(201).json({ message: 'Customer registered successfully', customerId });
  } catch (err) {
    console.error('Error in customer registration:', err);
    if (connection) await connection.rollback();
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Customer update
app.put('/api/customers/update/:customerId', async (req, res) => {
  const { customerId } = req.params;
  const { email, name, newPassword, confirmPassword, address, phone_number, alternate_phone_number, city, postal_code, region } = req.body;

  if (!email || !name || !region || region.trim() === '') {
    return res.status(400).json({ error: 'Email, name, and non-empty region are required' });
  }
  if (newPassword && newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'New passwords do not match' });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [customers] = await connection.query('SELECT * FROM customers WHERE id = ?', [customerId]);
    if (!customers.length) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const [existingEmail] = await connection.query('SELECT * FROM customers WHERE email = ? AND id != ?', [email, customerId]);
    if (existingEmail.length > 0) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const updateQuery = newPassword
      ? 'UPDATE customers SET email = ?, name = ?, password = ?, region = ? WHERE id = ?'
      : 'UPDATE customers SET email = ?, name = ?, region = ? WHERE id = ?';
    const updateParams = newPassword
      ? [email, name, await bcrypt.hash(newPassword, 10), region.trim(), customerId]
      : [email, name, region.trim(), customerId];
    await connection.query(updateQuery, updateParams);

    const [details] = await connection.query('SELECT * FROM customer_details WHERE customer_id = ?', [customerId]);
    if (details.length > 0) {
      await connection.query(
        'UPDATE customer_details SET address = ?, phone_number = ?, alternate_phone_number = ?, city = ?, postal_code = ? WHERE customer_id = ?',
        [address || null, phone_number || null, alternate_phone_number || null, city || null, postal_code || null, customerId]
      );
    } else if (address || phone_number || alternate_phone_number || city || postal_code) {
      await connection.query(
        'INSERT INTO customer_details (customer_id, address, phone_number, alternate_phone_number, city, postal_code) VALUES (?, ?, ?, ?, ?, ?)',
        [customerId, address || null, phone_number || null, alternate_phone_number || null, city || null, postal_code || null]
      );
    }

    await connection.commit();
    res.json({ message: 'Customer details updated successfully' });
  } catch (err) {
    console.error('Error updating customer:', err);
    if (connection) await connection.rollback();
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Get customer details
app.get('/api/customers/:customerId', async (req, res) => {
  const { customerId } = req.params;
  let connection;
  try {
    connection = await db.getConnection();
    const [customers] = await connection.query('SELECT email, name, region FROM customers WHERE id = ?', [customerId]);
    if (!customers.length) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const customer = customers[0];
    const [details] = await connection.query('SELECT address, phone_number, alternate_phone_number, city, postal_code FROM customer_details WHERE customer_id = ?', [customerId]);
    const customerDetails = details[0] || {};
    res.json({ ...customer, ...customerDetails });
  } catch (err) {
    console.error('Error fetching customer details:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Technician registration
app.post('/api/technicians/register', async (req, res) => {
  const { email, password, name, address, phone_number, pspla_number, nzbn_number, public_liability_insurance, city, postal_code, service_regions } = req.body;
  if (!email || !password || !name || !service_regions || !Array.isArray(service_regions)) {
    return res.status(400).json({ error: 'Email, password, name, and service regions are required' });
  }
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [existing] = await connection.query('SELECT * FROM technicians WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await connection.query('INSERT INTO technicians (email, password, name, is_available) VALUES (?, ?, ?, ?)', [email, hashedPassword, name, 1]);
    const technicianId = result.insertId;

    if (address || phone_number || pspla_number || nzbn_number || public_liability_insurance !== undefined || city || postal_code) {
      await connection.query(
        'INSERT INTO technician_details (technician_id, address, phone_number, pspla_number, nzbn_number, public_liability_insurance, city, postal_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [technicianId, address || null, phone_number || null, pspla_number || null, nzbn_number || null, public_liability_insurance || null, city || null, postal_code || null]
      );
    }

    const regionData = {
      technician_id: technicianId,
      auckland: service_regions.includes('Auckland') ? 1 : null,
      bay_of_plenty: service_regions.includes('Bay of Plenty') ? 1 : null,
      canterbury: service_regions.includes('Canterbury') ? 1 : null,
      gisborne: service_regions.includes('Gisborne') ? 1 : null,
      hawkes_bay: service_regions.includes('Hawke’s Bay') ? 1 : null,
      manawatu_whanganui: service_regions.includes('Manawatu-Whanganui') ? 1 : null,
      marlborough: service_regions.includes('Marlborough') ? 1 : null,
      nelson: service_regions.includes('Nelson') ? 1 : null,
      northland: service_regions.includes('Northland') ? 1 : null,
      otago: service_regions.includes('Otago') ? 1 : null,
      southland: service_regions.includes('Southland') ? 1 : null,
      taranaki: service_regions.includes('Taranaki') ? 1 : null,
      tasman: service_regions.includes('Tasman') ? 1 : null,
      waikato: service_regions.includes('Waikato') ? 1 : null,
      wellington: service_regions.includes('Wellington') ? 1 : null,
      west_coast: service_regions.includes('West Coast') ? 1 : null,
    };
    await connection.query(
      'INSERT INTO technician_service_regions (technician_id, auckland, bay_of_plenty, canterbury, gisborne, hawkes_bay, manawatu_whanganui, marlborough, nelson, northland, otago, southland, taranaki, tasman, waikato, wellington, west_coast) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        regionData.technician_id, regionData.auckland, regionData.bay_of_plenty, regionData.canterbury, regionData.gisborne,
        regionData.hawkes_bay, regionData.manawatu_whanganui, regionData.marlborough, regionData.nelson, regionData.northland,
        regionData.otago, regionData.southland, regionData.taranaki, regionData.tasman, regionData.waikato, regionData.wellington,
        regionData.west_coast
      ]
    );

    await connection.commit();
    res.status(201).json({ message: 'Technician registered successfully', userId: technicianId });
  } catch (err) {
    console.error('Error in technician registration:', err);
    if (connection) await connection.rollback();
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Technician update
app.put('/api/technicians/update/:technicianId', async (req, res) => {
  const { technicianId } = req.params;
  const { email, name, newPassword, confirmPassword, address, phone_number, pspla_number, nzbn_number, public_liability_insurance, city, postal_code, service_regions } = req.body;

  if (!email || !name || !service_regions || !Array.isArray(service_regions)) {
    return res.status(400).json({ error: 'Email, name, and service regions are required' });
  }
  if (newPassword && newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'New passwords do not match' });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [technicians] = await connection.query('SELECT * FROM technicians WHERE id = ?', [technicianId]);
    if (!technicians.length) {
      return res.status(404).json({ error: 'Technician not found' });
    }

    const [existingEmail] = await connection.query('SELECT * FROM technicians WHERE email = ? AND id != ?', [email, technicianId]);
    if (existingEmail.length > 0) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const updateQuery = newPassword
      ? 'UPDATE technicians SET email = ?, name = ?, password = ? WHERE id = ?'
      : 'UPDATE technicians SET email = ?, name = ? WHERE id = ?';
    const updateParams = newPassword
      ? [email, name, await bcrypt.hash(newPassword, 10), technicianId]
      : [email, name, technicianId];
    await connection.query(updateQuery, updateParams);

    const [details] = await connection.query('SELECT * FROM technician_details WHERE technician_id = ?', [technicianId]);
    if (details.length > 0) {
      await connection.query(
        'UPDATE technician_details SET address = ?, phone_number = ?, pspla_number = ?, nzbn_number = ?, public_liability_insurance = ?, city = ?, postal_code = ? WHERE technician_id = ?',
        [address || null, phone_number || null, pspla_number || null, nzbn_number || null, public_liability_insurance || null, city || null, postal_code || null, technicianId]
      );
    } else if (address || phone_number || pspla_number || nzbn_number || public_liability_insurance || city || postal_code) {
      await connection.query(
        'INSERT INTO technician_details (technician_id, address, phone_number, pspla_number, nzbn_number, public_liability_insurance, city, postal_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [technicianId, address || null, phone_number || null, pspla_number || null, nzbn_number || null, public_liability_insurance || null, city || null, postal_code || null]
      );
    }

    const regionData = {
      technician_id: technicianId,
      auckland: service_regions.includes('Auckland') ? 1 : null,
      bay_of_plenty: service_regions.includes('Bay of Plenty') ? 1 : null,
      canterbury: service_regions.includes('Canterbury') ? 1 : null,
      gisborne: service_regions.includes('Gisborne') ? 1 : null,
      hawkes_bay: service_regions.includes('Hawke’s Bay') ? 1 : null,
      manawatu_whanganui: service_regions.includes('Manawatu-Whanganui') ? 1 : null,
      marlborough: service_regions.includes('Marlborough') ? 1 : null,
      nelson: service_regions.includes('Nelson') ? 1 : null,
      northland: service_regions.includes('Northland') ? 1 : null,
      otago: service_regions.includes('Otago') ? 1 : null,
      southland: service_regions.includes('Southland') ? 1 : null,
      taranaki: service_regions.includes('Taranaki') ? 1 : null,
      tasman: service_regions.includes('Tasman') ? 1 : null,
      waikato: service_regions.includes('Waikato') ? 1 : null,
      wellington: service_regions.includes('Wellington') ? 1 : null,
      west_coast: service_regions.includes('West Coast') ? 1 : null,
    };
    await connection.query(
      'INSERT INTO technician_service_regions (technician_id, auckland, bay_of_plenty, canterbury, gisborne, hawkes_bay, manawatu_whanganui, marlborough, nelson, northland, otago, southland, taranaki, tasman, waikato, wellington, west_coast) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE auckland = VALUES(auckland), bay_of_plenty = VALUES(bay_of_plenty), canterbury = VALUES(canterbury), gisborne = VALUES(gisborne), hawkes_bay = VALUES(hawkes_bay), manawatu_whanganui = VALUES(manawatu_whanganui), marlborough = VALUES(marlborough), nelson = VALUES(nelson), northland = VALUES(northland), otago = VALUES(otago), southland = VALUES(southland), taranaki = VALUES(taranaki), tasman = VALUES(tasman), waikato = VALUES(waikato), wellington = VALUES(wellington), west_coast = VALUES(west_coast)',
      [
        regionData.technician_id, regionData.auckland, regionData.bay_of_plenty, regionData.canterbury, regionData.gisborne,
        regionData.hawkes_bay, regionData.manawatu_whanganui, regionData.marlborough, regionData.nelson, regionData.northland,
        regionData.otago, regionData.southland, regionData.taranaki, regionData.tasman, regionData.waikato, regionData.wellington,
        regionData.west_coast
      ]
    );

    await connection.commit();
    res.json({ message: 'Technician details updated successfully' });
  } catch (err) {
    console.error('Error in technician update:', err);
    if (connection) await connection.rollback();
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Get technician profile
app.get('/api/technician/profile/:technicianId', async (req, res) => {
  const { technicianId } = req.params;
  let connection;
  try {
    connection = await db.getConnection();
    const [regions] = await connection.query('SELECT * FROM technician_service_regions WHERE technician_id = ?', [technicianId]);
    if (!regions.length) {
      return res.status(404).json({ error: 'Technician not found' });
    }
    const regionData = regions[0];
    const service_regions = Object.keys(regionData)
      .filter(key => key !== 'technician_id' && regionData[key] === 1)
      .map(key => key.replace('_', ' ').replace(/\b\w/g, char => char.toUpperCase()));
    res.json({ regions: service_regions });
  } catch (err) {
    console.error('Error fetching technician profile:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Get technician details
app.get('/api/technicians/:technicianId', async (req, res) => {
  const { technicianId } = req.params;
  let connection;
  try {
    connection = await db.getConnection();
    const [technicians] = await connection.query('SELECT email, name FROM technicians WHERE id = ?', [technicianId]);
    if (!technicians.length) {
      return res.status(404).json({ error: 'Technician not found' });
    }
    const technician = technicians[0];
    const [details] = await connection.query('SELECT address, phone_number, pspla_number, nzbn_number, public_liability_insurance, city, postal_code FROM technician_details WHERE technician_id = ?', [technicianId]);
    const technicianDetails = details[0] || {};
    const [regions] = await connection.query('SELECT * FROM technician_service_regions WHERE technician_id = ?', [technicianId]);
    const regionData = regions[0] || {};
    const service_regions = Object.keys(regionData)
      .filter(key => key !== 'technician_id' && regionData[key] === 1)
      .map(key => key.replace('_', ' ').replace(/\b\w/g, char => char.toUpperCase()));
    res.json({ ...technician, ...technicianDetails, service_regions });
  } catch (err) {
    console.error('Error fetching technician details:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Customer login
app.post('/api/customers/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  let connection;
  try {
    connection = await db.getConnection();
    const [users] = await connection.query('SELECT * FROM customers WHERE email = ?', [email]);
    if (!users.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.json({ userId: user.id, role: 'customer', name: user.name });
  } catch (err) {
    console.error('Error in customer login:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Technician login
app.post('/api/technicians/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  let connection;
  try {
    connection = await db.getConnection();
    const [users] = await connection.query('SELECT * FROM technicians WHERE email = ?', [email]);
    if (!users.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.json({ userId: user.id, role: 'technician', name: user.name });
  } catch (err) {
    console.error('Error in technician login:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Create service request
app.post('/api/requests', async (req, res) => {
  const { customer_id, repair_description, availability_1, availability_2, region } = req.body;
  console.log('Received /api/requests:', { customer_id, repair_description, availability_1, availability_2, region });

  // Validation
  const missingFields = [];
  if (!customer_id && customer_id !== 0) missingFields.push('customer_id');
  if (!availability_1) missingFields.push('availability_1');
  if (!region || region.trim() === '') missingFields.push('region');
  if (missingFields.length > 0) {
    console.warn('Missing required fields in /api/requests:', missingFields);
    return res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}`, missingFields });
  }

  const parsedCustomerId = parseInt(customer_id);
  if (isNaN(parsedCustomerId)) {
    console.warn('Invalid customer_id:', customer_id);
    return res.status(400).json({ error: 'Customer ID must be a valid number', field: 'customer_id' });
  }

  // Allow empty repair_description with default
  const finalRepairDescription = repair_description && repair_description.trim() !== '' ? repair_description.trim() : 'No description provided';

  // Relaxed region regex to allow apostrophes (e.g., Hawke’s Bay)
  if (!/^[a-zA-Z\s'-]+$/.test(region.trim())) {
    console.warn('Invalid region:', region);
    return res.status(400).json({ error: 'Region must contain only letters, spaces, hyphens, or apostrophes', field: 'region' });
  }

  let connection;
  try {
    connection = await db.getConnection();
    const [customer] = await connection.query('SELECT id, email, name FROM customers WHERE id = ?', [parsedCustomerId]);
    if (!customer.length) {
      console.warn('Customer not found:', parsedCustomerId);
      return res.status(404).json({ error: 'Customer not found', field: 'customer_id' });
    }

    const avail1 = moment.tz(availability_1, 'DD/MM/YYYY HH:mm:ss', 'Pacific/Auckland');
    if (!avail1.isValid()) {
      console.warn('Invalid availability_1 format:', availability_1);
      return res.status(400).json({ error: 'Invalid date format for availability_1. Use DD/MM/YYYY HH:MM:SS', field: 'availability_1' });
    }
    const mysqlAvail1 = avail1.format('YYYY-MM-DD HH:mm:ss');

    let mysqlAvail2 = null;
    if (availability_2) {
      const avail2 = moment.tz(availability_2, 'DD/MM/YYYY HH:mm:ss', 'Pacific/Auckland');
      if (!avail2.isValid()) {
        console.warn('Invalid availability_2 format:', availability_2);
        return res.status(400).json({ error: 'Invalid date format for availability_2. Use DD/MM/YYYY HH:MM:SS', field: 'availability_2' });
      }
      mysqlAvail2 = avail2.format('YYYY-MM-DD HH:mm:ss');
    }

    if (!isValidFutureDate(availability_1) || (availability_2 && !isValidFutureDate(availability_2))) {
      console.warn('Past availability dates:', { availability_1, availability_2 });
      return res.status(400).json({ error: 'Availability times cannot be in the past', field: availability_2 ? 'availability_1, availability_2' : 'availability_1' });
    }

    // Generate mock payment ID
    const paymentId = generateMockPaymentId(parsedCustomerId);

    const createdAt = moment.tz('Pacific/Auckland').format('YYYY-MM-DD HH:mm:ss');
    try {
      const [result] = await connection.query(
        'INSERT INTO service_requests (customer_id, repair_description, created_at, status, customer_availability_1, customer_availability_2, payment_id, payment_status, region) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [parsedCustomerId, finalRepairDescription, createdAt, 'pending', mysqlAvail1, mysqlAvail2, paymentId, 'pending', region.trim()]
      );
      const requestId = result.insertId;
      await connection.commit();
      await broadcastUpdate(requestId, 'new_job');
      res.status(201).json({ message: 'Service request created successfully', requestId, paymentId });
    } catch (dbErr) {
      console.error('Database error in /api/requests:', dbErr);
      await connection.rollback();
      return res.status(500).json({ error: 'Database error', details: dbErr.message, field: 'database' });
    }
  } catch (err) {
    console.error('Error creating service request:', {
      error: err.message,
      stack: err.stack,
      requestBody: { customer_id, repair_description, availability_1, availability_2, region }
    });
    res.status(500).json({ error: 'Server error', details: err.message, field: 'general' });
  } finally {
    if (connection) connection.release();
  }
});

// Get customer requests
app.get('/api/requests/customer/:customerId', async (req, res) => {
  const { customerId } = req.params;
  let connection;
  try {
    connection = await db.getConnection();
    const [requests] = await connection.query(`
      SELECT sr.*, c.name AS customer_name, cd.address AS customer_address, cd.city AS customer_city, cd.postal_code AS customer_postal_code,
             t.name AS technician_name
      FROM service_requests sr
      LEFT JOIN customers c ON sr.customer_id = c.id
      LEFT JOIN customer_details cd ON c.id = cd.customer_id
      LEFT JOIN technicians t ON sr.technician_id = t.id
      WHERE sr.customer_id = ?
      ORDER BY sr.created_at DESC
    `, [customerId]);
    const formattedRequests = requests.map(req => ({
      ...req,
      customer_availability_1: formatToClientDateTime(req.customer_availability_1),
      customer_availability_2: formatToClientDateTime(req.customer_availability_2),
      technician_scheduled_time: formatToClientDateTime(req.technician_scheduled_time),
      created_at: formatToClientDateTime(req.created_at)
    }));
    res.json(formattedRequests);
  } catch (err) {
    console.error('Error fetching customer requests:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Get available requests
app.get('/api/requests/available', async (req, res) => {
  const technicianId = req.query.technicianId ? parseInt(req.query.technicianId) : null;
  let connection;
  try {
    connection = await db.getConnection();
    let query = `
      SELECT sr.id, sr.repair_description, sr.created_at, sr.status, sr.customer_availability_1, 
             sr.customer_availability_2, sr.technician_id, sr.technician_scheduled_time,
             c.name AS customer_name, cd.address AS customer_address, cd.city AS customer_city, cd.postal_code AS customer_postal_code, sr.region
      FROM service_requests sr
      JOIN customers c ON sr.customer_id = c.id
      LEFT JOIN customer_details cd ON c.id = cd.customer_id
      WHERE sr.status = 'pending' AND sr.technician_id IS NULL
    `;
    const params = [];
    if (technicianId) {
      const [regions] = await connection.query('SELECT * FROM technician_service_regions WHERE technician_id = ?', [technicianId]);
      const regionData = regions[0] || {};
      const conditions = Object.keys(regionData)
        .filter(key => key !== 'technician_id' && regionData[key] === 1)
        .map(key => `sr.region = '${key.replace('_', ' ').replace(/\b\w/g, char => char.toUpperCase())}'`);
      if (conditions.length) {
        query += ` AND (${conditions.join(' OR ')})`;
        params.push(technicianId);
      }
    }
    const [requests] = await connection.query(query, params);
    const formattedRequests = requests.map(req => ({
      ...req,
      customer_availability_1: formatToClientDateTime(req.customer_availability_1),
      customer_availability_2: formatToClientDateTime(req.customer_availability_2),
      technician_scheduled_time: formatToClientDateTime(req.technician_scheduled_time),
      created_at: formatToClientDateTime(req.created_at)
    }));
    res.json(formattedRequests);
  } catch (err) {
    console.error('Error fetching available requests:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Get technician requests
app.get('/api/requests/technician/:technicianId', async (req, res) => {
  const { technicianId } = req.params;
  let connection;
  try {
    connection = await db.getConnection();
    const [requests] = await connection.query(`
      SELECT sr.*, c.name AS customer_name, cd.address AS customer_address, cd.city AS customer_city, cd.postal_code AS customer_postal_code
      FROM service_requests sr
      JOIN customers c ON sr.customer_id = c.id
      LEFT JOIN customer_details cd ON c.id = cd.customer_id
      WHERE sr.technician_id = ? AND sr.status != 'cancelled'
      ORDER BY sr.created_at DESC
    `, [technicianId]);
    const formattedRequests = requests.map(req => ({
      ...req,
      customer_availability_1: formatToClientDateTime(req.customer_availability_1),
      customer_availability_2: formatToClientDateTime(req.customer_availability_2),
      technician_scheduled_time: formatToClientDateTime(req.technician_scheduled_time),
      created_at: formatToClientDateTime(req.created_at)
    }));
    res.json(formattedRequests);
  } catch (err) {
    console.error('Error fetching technician requests:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Assign request to technician
app.put('/api/requests/assign/:requestId', async (req, res) => {
  const { requestId } = req.params;
  const { technicianId, scheduledTime } = req.body;
  if (!technicianId || !scheduledTime) {
    return res.status(400).json({ error: 'Technician ID and scheduled time are required' });
  }
  if (!isValidFutureDate(scheduledTime)) {
    return res.status(400).json({ error: 'Scheduled time cannot be in the past' });
  }
  let connection;
  try {
    connection = await db.getConnection();
    const [request] = await connection.query('SELECT * FROM service_requests WHERE id = ? AND status = "pending" AND technician_id IS NULL', [requestId]);
    if (request.length === 0) {
      return res.status(404).json({ error: 'Request not found or already assigned' });
    }
    const paymentId = generateMockPaymentId(request[0].customer_id);
    const mysqlScheduledTime = toMySQLDateTime(scheduledTime);
    const [result] = await connection.query(
      'UPDATE service_requests SET technician_id = ?, status = ?, technician_scheduled_time = ?, payment_id = ?, payment_status = ? WHERE id = ? AND status = ? AND technician_id IS NULL',
      [technicianId, 'assigned', mysqlScheduledTime, paymentId, 'authorized', requestId, 'pending']
    );
    if (result.affectedRows === 0) {
      return res.status(400).json({ error: 'Request not found or already assigned' });
    }

    await broadcastUpdate(requestId, 'update');
    res.json({ message: 'Request assigned successfully, payment authorized' });
  } catch (err) {
    console.error('Error in assign endpoint:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Unassign request
app.put('/api/requests/unassign/:requestId', async (req, res) => {
  const { requestId } = req.params;
  const { technicianId } = req.body;
  if (!technicianId) {
    return res.status(400).json({ error: 'Technician ID is required' });
  }
  let connection;
  try {
    connection = await db.getConnection();
    const [result] = await connection.query(
      'UPDATE service_requests SET technician_id = NULL, status = ?, technician_scheduled_time = NULL, payment_status = ? WHERE id = ? AND technician_id = ? AND status = ?',
      ['pending', 'pending', requestId, technicianId, 'assigned']
    );
    if (result.affectedRows === 0) {
      return res.status(400).json({ error: 'Request not found or not assigned to this technician' });
    }

    await broadcastUpdate(requestId, 'update');
    res.json({ message: 'Request unassigned successfully' });
  } catch (err) {
    console.error('Error in unassign endpoint:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Reschedule request
app.put('/api/requests/reschedule/:requestId', async (req, res) => {
  const { requestId } = req.params;
  const { customerId, availability_1, availability_2 } = req.body;
  if (!customerId || !availability_1) {
    return res.status(400).json({ error: 'Customer ID and availability 1 are required' });
  }
  let connection;
  try {
    connection = await db.getConnection();
    const avail1 = moment.tz(availability_1, 'DD/MM/YYYY HH:mm:ss', 'Pacific/Auckland');
    if (!avail1.isValid()) {
      return res.status(400).json({ error: 'Invalid date format for availability_1. Use DD/MM/YYYY HH:MM:SS', field: 'availability_1' });
    }
    const mysqlAvail1 = avail1.format('YYYY-MM-DD HH:mm:ss');

    let mysqlAvail2 = null;
    if (availability_2) {
      const avail2 = moment.tz(availability_2, 'DD/MM/YYYY HH:mm:ss', 'Pacific/Auckland');
      if (!avail2.isValid()) {
        return res.status(400).json({ error: 'Invalid date format for availability_2. Use DD/MM/YYYY HH:MM:SS', field: 'availability_2' });
      }
      mysqlAvail2 = avail2.format('YYYY-MM-DD HH:mm:ss');
    }

    if (!isValidFutureDate(availability_1) || (availability_2 && !isValidFutureDate(availability_2))) {
      return res.status(400).json({ error: 'Availability times cannot be in the past', field: availability_2 ? 'availability_1, availability_2' : 'availability_1' });
    }

    const [request] = await connection.query('SELECT status, technician_scheduled_time, customer_id FROM service_requests WHERE id = ?', [requestId]);
    if (!request.length) {
      return res.status(404).json({ error: 'Request not found' });
    }
    if (customerId != request[0].customer_id) {
      return res.status(403).json({ error: 'Unauthorized to reschedule this request' });
    }
    const scheduledTime = request[0].technician_scheduled_time ? moment(request[0].technician_scheduled_time).tz('Pacific/Auckland') : null;
    const now = moment.tz('Pacific/Auckland');
    if (scheduledTime && scheduledTime.diff(now, 'hours') <= 2) {
      return res.status(400).json({ error: 'Cannot reschedule within 2 hours of scheduled time' });
    }

    const [result] = await connection.query(
      'UPDATE service_requests SET customer_availability_1 = ?, customer_availability_2 = ?, status = ?, technician_id = NULL, technician_scheduled_time = NULL, payment_status = ? WHERE id = ? AND customer_id = ? AND (status = ? OR status = ?)',
      [mysqlAvail1, mysqlAvail2, 'pending', 'pending', requestId, customerId, 'pending', 'assigned']
    );
    if (result.affectedRows === 0) {
      return res.status(400).json({ error: 'Request not found or not reschedulable' });
    }

    await broadcastUpdate(requestId, 'update');
    res.json({ message: 'Request rescheduled successfully and placed back in available jobs' });
  } catch (err) {
    console.error('Error in reschedule endpoint:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Complete request by technician
app.put('/api/requests/complete-technician/:requestId', async (req, res) => {
  const { requestId } = req.params;
  const { technicianId, note } = req.body;
  if (!technicianId) {
    return res.status(400).json({ error: 'Technician ID is required' });
  }
  let connection;
  try {
    connection = await db.getConnection();
    const [result] = await connection.query(
      'UPDATE service_requests SET status = ?, technician_note = ? WHERE id = ? AND technician_id = ? AND status = ?',
      ['completed_technician', note || null, requestId, technicianId, 'assigned']
    );
    if (result.affectedRows === 0) {
      return res.status(400).json({ error: 'Request not found or not assigned to this technician' });
    }

    await broadcastUpdate(requestId, 'update');
    res.json({ message: 'Request marked as completed by technician' });
  } catch (err) {
    console.error('Error in complete-technician endpoint:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Confirm completion by customer
app.put('/api/requests/confirm-completion/:requestId', async (req, res) => {
  const { requestId } = req.params;
  const { customerId } = req.body;
  if (!customerId) {
    return res.status(400).json({ error: 'Customer ID is required' });
  }
  let connection;
  try {
    connection = await db.getConnection();
    const [request] = await connection.query('SELECT * FROM service_requests WHERE id = ? AND customer_id = ? AND status = ?', [requestId, customerId, 'completed_technician']);
    if (request.length === 0) {
      return res.status(400).json({ error: 'Request not found or not ready for confirmation' });
    }
    const [result] = await connection.query(
      'UPDATE service_requests SET status = ?, payment_status = ? WHERE id = ? AND customer_id = ? AND status = ?',
      ['completed', 'captured', requestId, customerId, 'completed_technician']
    );
    if (result.affectedRows === 0) {
      return res.status(400).json({ error: 'Request not found or not ready for confirmation' });
    }

    await broadcastUpdate(requestId, 'update');
    res.json({ message: 'Request completion confirmed, payment captured' });
  } catch (err) {
    console.error('Error in confirm-completion endpoint:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Cancel service request
app.delete('/api/requests/:id', async (req, res) => {
  const { id } = req.params;
  const customerId = req.body.customerId || req.query.customerId;
  if (!customerId) {
    return res.status(400).json({ error: 'Customer ID is required' });
  }
  let connection;
  try {
    connection = await db.getConnection();
    const [request] = await connection.query('SELECT technician_scheduled_time, customer_id FROM service_requests WHERE id = ?', [id]);
    if (!request.length) {
      return res.status(404).json({ error: 'Request not found' });
    }
    if (customerId != request[0].customer_id) {
      return res.status(403).json({ error: 'Unauthorized to cancel this request' });
    }
    const scheduledTime = request[0].technician_scheduled_time ? moment(request[0].technician_scheduled_time).tz('Pacific/Auckland') : null;
    const now = moment.tz('Pacific/Auckland');
    if (scheduledTime && scheduledTime.diff(now, 'hours') <= 2) {
      return res.status(400).json({ error: 'Cannot cancel within 2 hours of scheduled time' });
    }

    const [result] = await connection.query('UPDATE service_requests SET status = ? WHERE id = ?', ['cancelled', id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    await broadcastUpdate(id, 'update');
    res.json({ message: 'Request cancelled successfully' });
  } catch (err) {
    console.error('Error cancelling request:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Propose new time for request
app.post('/api/requests/propose/:requestId', async (req, res) => {
  const { requestId } = req.params;
  const { technicianId, proposedTime } = req.body;
  if (!technicianId || !proposedTime) {
    return res.status(400).json({ error: 'Technician ID and proposed time are required' });
  }
  if (!isValidFutureDate(proposedTime)) {
    return res.status(400).json({ error: 'Proposed time cannot be in the past' });
  }
  let connection;
  try {
    connection = await db.getConnection();
    const [requestRows] = await connection.query('SELECT * FROM service_requests WHERE id = ? AND technician_id = ?', [requestId, technicianId]);
    if (requestRows.length === 0) {
      return res.status(404).json({ error: 'Request not found or not assigned to technician' });
    }
    const mysqlProposedTime = toMySQLDateTime(proposedTime);
    const [result] = await connection.query(
      'INSERT INTO pending_proposals (request_id, technician_id, proposed_time, status, created_at) VALUES (?, ?, ?, ?, NOW())',
      [requestId, technicianId, mysqlProposedTime, 'pending']
    );
    const proposal = {
      id: result.insertId,
      request_id: parseInt(requestId),
      technician_id: parseInt(technicianId),
      proposed_time: mysqlProposedTime,
      status: 'pending',
      created_at: moment().tz('Pacific/Auckland').format('YYYY-MM-DD HH:mm:ss')
    };
    await broadcastProposal(proposal, requestId);
    res.json({ message: 'Proposal submitted successfully' });
  } catch (err) {
    console.error('Error proposing time:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Confirm or decline proposal
app.put('/api/requests/confirm-proposal/:requestId', async (req, res) => {
  const { requestId } = req.params;
  const { customerId, proposalId, action } = req.body;
  if (!customerId || !proposalId || !action || !['approve', 'decline'].includes(action)) {
    return res.status(400).json({ error: 'Missing or invalid fields' });
  }
  let connection;
  try {
    connection = await db.getConnection();
    const [proposalRows] = await connection.query('SELECT * FROM pending_proposals WHERE id = ? AND request_id = ?', [proposalId, requestId]);
    if (proposalRows.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    const proposal = proposalRows[0];
    const [requestRows] = await connection.query('SELECT * FROM service_requests WHERE id = ? AND customer_id = ?', [requestId, customerId]);
    if (requestRows.length === 0) {
      return res.status(404).json({ error: 'Request not found or not owned by customer' });
    }
    if (action === 'approve') {
      await connection.query(
        'UPDATE service_requests SET technician_scheduled_time = ?, status = ? WHERE id = ?',
        [proposal.proposed_time, 'assigned', requestId]
      );
      await connection.query('UPDATE pending_proposals SET status = ? WHERE id = ?', ['approved', proposalId]);
      proposal.status = 'approved';
    } else {
      await connection.query(
        'UPDATE service_requests SET technician_id = NULL, technician_scheduled_time = NULL, status = ? WHERE id = ?',
        ['pending', requestId]
      );
      await connection.query('UPDATE pending_proposals SET status = ? WHERE id = ?', ['declined', proposalId]);
      proposal.status = 'declined';
    }
    await broadcastProposal(proposal, requestId);
    await broadcastUpdate(requestId, 'update');
    res.json({ message: `Proposal ${action}d successfully` });
  } catch (err) {
    console.error(`Error ${action}ing proposal:`, err);
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Get pending proposals for customer
app.get('/api/requests/pending-proposals/:customerId', async (req, res) => {
  const { customerId } = req.params;
  let connection;
  try {
    connection = await db.getConnection();
    const [rows] = await connection.query(`
      SELECT pp.*, t.name AS technician_name
      FROM pending_proposals pp
      JOIN service_requests sr ON pp.request_id = sr.id
      JOIN technicians t ON pp.technician_id = t.id
      WHERE sr.customer_id = ? AND pp.status = 'pending'
    `, [customerId]);
    res.json(rows.map(row => ({
      id: row.id,
      request_id: row.request_id,
      technician_id: row.technician_id,
      technician_name: row.technician_name,
      proposed_time: formatToClientDateTime(row.proposed_time),
      status: row.status,
      created_at: formatToClientDateTime(row.created_at)
    })));
  } catch (err) {
    console.error('Error fetching pending proposals:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Technician response to service request (accept/decline/propose)
app.put('/api/requests/respond/:requestId', async (req, res) => {
  const { requestId } = req.params;
  const { technicianId, action, proposedDate } = req.body;

  if (!technicianId || !action) {
    return res.status(400).json({ error: 'Technician ID and action are required' });
  }
  if (action === 'propose' && !proposedDate) {
    return res.status(400).json({ error: 'Proposed date is required for propose action' });
  }
  if (!['accept', 'decline', 'propose'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action. Use accept, decline, or propose' });
  }
  if (proposedDate && !isValidFutureDate(proposedDate)) {
    return res.status(400).json({ error: 'Proposed date cannot be in the past' });
  }

  let connection;
  try {
    connection = await db.getConnection();
    const [request] = await connection.query('SELECT * FROM service_requests WHERE id = ?', [requestId]);
    if (!request.length) {
      return res.status(404).json({ error: 'Request not found' });
    }

    let updateQuery, updateParams;
    if (action === 'accept') {
      updateQuery = 'UPDATE service_requests SET status = ?, technician_id = ?, technician_scheduled_time = ? WHERE id = ? AND status = ? AND technician_id IS NULL';
      updateParams = ['assigned', technicianId, request[0].customer_availability_1, requestId, 'pending'];
    } else if (action === 'decline') {
      updateQuery = 'UPDATE service_requests SET technician_id = NULL, status = ?, technician_scheduled_time = NULL WHERE id = ?';
      updateParams = ['pending', requestId];
    } else {
      const mysqlProposedDate = toMySQLDateTime(proposedDate);
      const [result] = await connection.query(
        'INSERT INTO pending_proposals (request_id, technician_id, proposed_time, status, created_at) VALUES (?, ?, ?, ?, NOW())',
        [requestId, technicianId, mysqlProposedDate, 'pending']
      );
      const proposal = {
        id: result.insertId,
        request_id: parseInt(requestId),
        technician_id: parseInt(technicianId),
        proposed_time: mysqlProposedDate,
        status: 'pending',
        created_at: moment().tz('Pacific/Auckland').format('YYYY-MM-DD HH:mm:ss')
      };
      await broadcastProposal(proposal, requestId);
      res.json({ message: `Proposal submitted successfully with proposed date ${proposedDate}` });
      return;
    }

    const [result] = await connection.query(updateQuery, updateParams);
    if (result.affectedRows === 0) {
      return res.status(400).json({ error: 'Failed to update request' });
    }

    await broadcastUpdate(requestId, 'update');
    res.json({ message: `Request ${action}ed successfully` });
  } catch (err) {
    console.error('Error in respond endpoint:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket server running on ws://localhost:${PORT}`);
});