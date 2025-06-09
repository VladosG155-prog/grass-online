const WebSocket = require('ws');
require('dotenv').config();
const express = require('express');
const http = require('http');
const url = require('url');
const cors = require('cors');

const count = new Map();

const app = express();
app.use(cors());
app.use(express.json());

// HTTP сервер для Express
const server = http.createServer(app);
server.listen(8081, () => {
  console.log('HTTP server running on http://0.0.0.0:8081');
});

app.get('/api/status', (req, res) => {
  console.log('Received HTTP request for /api/status from:', req.ip, 'Query:', req.query);
  const mac = req.query.mac_address;

  if (!mac) {
    console.log('Missing mac_address');
    return res.status(400).json({ error: 'mac_address required' });
  }

  if (count.has(mac)) {
    const countTotal = count.get(mac).reduce((acc, curr) => {
      const val = isNaN(curr.countNetworks) ? 0 : +curr.countNetworks;
      return val + acc;
    }, 0);
    console.log(`Returning count: ${countTotal} for mac: ${mac}`);
    return res.json({ count: countTotal });
  } else {
    console.log(`No data for mac: ${mac}`);
    res.json({ count: 0 });
  }
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// HTTP сервер для WebSocket
const wssServer = http.createServer();
const wss = new WebSocket.Server({ server: wssServer });

wssServer.listen(8082, () => {
  console.log('WebSocket server running on ws://0.0.0.0:8082');
});

wss.on('connection', (ws, req) => {
  const query = url.parse(req.url, true).query;
  const mac_address = query.mac_address;
  const idToken = query.idToken;
  const countNetworks = query.count;

  console.log('New WS connection from:', req.connection.remoteAddress, 'Query:', query);

  if (!mac_address || !idToken || !countNetworks) {
    ws.send(JSON.stringify({ type: 'error', message: 'mac_address, idToken, and count are required' }));
    ws.close();
    return;
  }

  if (count.has(mac_address)) {
    count.set(mac_address, [...count.get(mac_address), { idToken, countNetworks }]);
  } else {
    count.set(mac_address, [{ idToken, countNetworks }]);
  }

  console.log('Current count:', count);

  ws.on('close', () => {
    const filter = count.get(mac_address).filter(obj => obj.idToken !== idToken);
    console.log('Filtered data:', filter);
    count.set(mac_address, filter);
    console.log(`Client disconnected: ${mac_address}`);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});
