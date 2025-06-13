require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const WebSocket = require('ws');
const http = require('http');
const url = require('url');
const ExchangeAPI = require('./exchanges');
const Database = require('./database');
const ArbitrageDetector = require('./arbitrage');
const AuthManager = require('./auth');
const { getJapanTime } = require('./utils');

const app = express();
const server = http.createServer(app);
const authManager = new AuthManager();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "ws://localhost:*", "wss://localhost:*"]
    }
  },
  frameguard: { action: 'deny' },
  xssFilter: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 60,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// WebSocket server with connection limits
const wss = new WebSocket.Server({ 
  server,
  maxPayload: parseInt(process.env.WS_MAX_PAYLOAD) || 16 * 1024,
  clientTracking: true
});

const PORT = process.env.PORT || 3001;

// CORS configuration - restrict in production
const getAllowedOrigins = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.ALLOWED_ORIGINS_PRODUCTION?.split(',') || [];
  } else {
    return process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://127.0.0.1:3000'];
  }
};

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = getAllowedOrigins();
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};
app.use(cors(corsOptions));

// JSON parsing with error handling
app.use((req, res, next) => {
  express.json()(req, res, (err) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
    next();
  });
});

const exchangeAPI = new ExchangeAPI();
const database = new Database();
const arbitrageDetector = new ArbitrageDetector(database);

let currentPrices = [];
let currentOpportunities = [];

// Input validation function
function validateExchangeName(name) {
  if (!name) return true; // Allow empty for all exchanges
  const validExchanges = ['bitFlyer', 'Coincheck', 'Zaif', 'GMO', 'bitbank', 'BITPoint'];
  return validExchanges.includes(name) && name.length < 50;
}

app.get('/api/prices', (req, res) => {
  const { exchange } = req.query;
  
  if (exchange && !validateExchangeName(exchange)) {
    return res.status(400).json({ error: 'Invalid exchange name' });
  }
  
  res.json({
    prices: currentPrices,
    opportunities: currentOpportunities,
    timestamp: getJapanTime()
  });
});

app.get('/api/history', async (req, res) => {
  try {
    const { exchange } = req.query;
    
    if (exchange && !validateExchangeName(exchange)) {
      return res.status(400).json({ error: 'Invalid input' });
    }
    
    const priceHistory = await database.getRecentPrices(100);
    const arbitrageHistory = await database.getArbitrageHistory(50);
    
    res.json({
      priceHistory,
      arbitrageHistory
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Input validation middleware
function validateHoursParam(req, res, next) {
  const hours = req.query.hours;
  if (hours !== undefined) {
    const parsed = parseInt(hours);
    if (isNaN(parsed) || parsed < 1 || parsed > 168) { // Max 1 week
      return res.status(400).json({ error: 'Invalid hours parameter. Must be between 1 and 168.' });
    }
    req.validatedHours = parsed;
  } else {
    req.validatedHours = 24;
  }
  next();
}

app.get('/api/price-history', validateHoursParam, async (req, res) => {
  try {
    const hours = req.validatedHours;
    const priceHistory = await database.getPriceHistory(hours);
    
    res.json({
      priceHistory
    });
  } catch (error) {
    console.error('Error fetching price history:', error);
    res.status(500).json({ error: 'Failed to fetch price history' });
  }
});

// Authentication endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  const token = authManager.authenticate(username, password);
  if (token) {
    res.json({ token, message: 'Authentication successful' });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Token validation endpoint
app.get('/api/validate-token', authManager.requireAuth.bind(authManager), (req, res) => {
  res.json({ valid: true, user: req.user });
});

// Test endpoint for price validation
app.post('/api/test-price', (req, res) => {
  const { price } = req.body;
  
  if (price === null || price === undefined || 
      typeof price !== 'number' || 
      price <= 0 || 
      price > 100000000 || 
      !isFinite(price)) {
    return res.status(400).json({ error: 'Invalid price value' });
  }
  
  res.json({ valid: true, price });
});

// Admin endpoints (for security testing)
app.get('/api/admin/config', authManager.requireAuth.bind(authManager), (req, res) => {
  res.json({ config: 'admin configuration' });
});

app.get('/api/admin/users', authManager.requireAuth.bind(authManager), (req, res) => {
  res.json({ users: [] });
});

app.get('/api/admin/logs', authManager.requireAuth.bind(authManager), (req, res) => {
  res.json({ logs: [] });
});

// Protected route - clear data (requires authentication)
app.delete('/api/clear-data', authManager.requireAuth.bind(authManager), async (req, res) => {
  try {
    await database.clearAllData();
    res.json({ message: 'All price history and arbitrage data cleared successfully' });
  } catch (error) {
    console.error('Error clearing data:', error);
    res.status(500).json({ error: 'Failed to clear data' });
  }
});

// Protected route - CSV export (requires authentication)
app.get('/api/export-csv', authManager.requireAuth.bind(authManager), validateHoursParam, async (req, res) => {
  try {
    const hours = req.validatedHours;
    const priceHistory = await database.getPriceHistory(hours);
    
    // Sanitize filename to prevent path traversal
    const safeFilename = `price_history_${hours}h.csv`.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    // CSV header
    let csv = 'Exchange,Price,Bid,Ask,Timestamp,Created_At\n';
    
    // CSV data rows with proper escaping
    priceHistory.forEach(row => {
      const escapeCSV = (val) => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      
      csv += `${escapeCSV(row.exchange)},${escapeCSV(row.price)},${escapeCSV(row.bid)},${escapeCSV(row.ask)},${escapeCSV(row.timestamp)},${escapeCSV(row.created_at)}\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// Track connections for rate limiting
let connectionCount = 0;
const MAX_CONNECTIONS = parseInt(process.env.MAX_WS_CONNECTIONS) || 50;

wss.on('connection', (ws, req) => {
  connectionCount++;
  
  if (connectionCount > MAX_CONNECTIONS) {
    ws.close(1013, 'Server overloaded');
    connectionCount--;
    return;
  }
  
  // Extract token from query parameters for WebSocket authentication
  const query = url.parse(req.url, true).query;
  const token = query.token;
  
  // For admin functions, require authentication
  if (query.requireAuth === 'true' && !authManager.authenticateWebSocket(token)) {
    ws.close(1008, 'Authentication required');
    connectionCount--;
    return;
  }
  
  console.log(`Client connected via WebSocket (${connectionCount}/${MAX_CONNECTIONS})`);
  
  ws.send(JSON.stringify({
    type: 'initial_data',
    prices: currentPrices,
    opportunities: currentOpportunities
  }));

  ws.on('close', () => {
    connectionCount--;
    console.log(`Client disconnected (${connectionCount}/${MAX_CONNECTIONS})`);
  });
  
  // Handle potential errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    connectionCount--;
  });
});

function broadcastToClients(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

async function fetchPricesAndDetectArbitrage() {
  try {
    const prices = await exchangeAPI.getAllPrices();
    
    if (prices.length > 0) {
      currentPrices = prices;
      
      await database.savePrices(prices);
      
      const opportunities = arbitrageDetector.detectArbitrageOpportunities(prices);
      currentOpportunities = opportunities;
      
      const data = {
        type: 'price_update',
        prices: currentPrices,
        opportunities: currentOpportunities,
        timestamp: getJapanTime()
      };
      
      broadcastToClients(data);
      
      if (opportunities.length > 0) {
        console.log(`Found ${opportunities.length} arbitrage opportunities:`);
        opportunities.forEach(opp => {
          console.log(arbitrageDetector.formatOpportunityMessage(opp));
        });
      }
    }
  } catch (error) {
    console.error('Error in price fetching cycle:', error);
  }
}

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

setInterval(fetchPricesAndDetectArbitrage, 5000);

fetchPricesAndDetectArbitrage();

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server started`);
  console.log(`Price monitoring started - fetching every 5 seconds`);
});

process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  database.close();
  server.close(() => {
    process.exit(0);
  });
});

// Export for testing
module.exports = { app, server };