// Minimal test server to debug hanging issue
const express = require('express');
const app = express();

// Simple logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Simple CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Test route
app.get('/test', (req, res) => {
  console.log('Test route hit');
  res.json({ message: 'Minimal server works!', timestamp: new Date().toISOString() });
});

// Health route
app.get('/health', (req, res) => {
  console.log('Health route hit');
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// Root route
app.get('/', (req, res) => {
  console.log('Root route hit');
  res.send('<h1>Minimal Server Test</h1><p>If you see this, the server is working!</p>');
});

const PORT = process.env.PORT || 3183;
const server = app.listen(PORT, () => {
  console.log(`🚀 Minimal test server running on http://localhost:${PORT}`);
  console.log(`📝 Test: http://localhost:${PORT}/test`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
});

// Handle errors
server.on('error', (err) => {
  console.error('Server error:', err);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

