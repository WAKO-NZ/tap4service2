const WebSocket = require('ws');

// Create WebSocket server on port 8080
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (message) => {
    console.log('Received:', message);
    const data = JSON.parse(message);
    if (data.type === 'subscribe' && data.technicianId) {
      // Simulate a subscription (store technicianId if needed)
      console.log(`Subscribed technician ID: ${data.technicianId}`);

      // Simulate sending an update after 5 seconds
      setTimeout(() => {
        const update = {
          type: 'update',
          requestId: 1,
          status: 'assigned',
          technician_scheduled_time: new Date().toISOString(),
          customer_availability_1: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
          customer_availability_2: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
        };
        ws.send(JSON.stringify(update));
        console.log('Sent update:', update);
      }, 5000);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

console.log(`WebSocket server running on ${process.env.WS_URL || 'ws://localhost:8080'}`);