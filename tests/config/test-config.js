// Test configuration file for Bitcoin Arbitrage monitoring system
// This file centralizes sensitive test data to improve security

module.exports = {
  // Exchange configuration
  exchanges: {
    // Public exchange names (safe to use in tests)
    supported: ['bitFlyer', 'Coincheck', 'Zaif', 'GMOコイン', 'bitbank', 'BITPoint'],
    // Test exchange names (use these instead of real ones)
    test: ['TestExchange1', 'TestExchange2', 'TestExchange3']
  },
  
  // Price ranges for test data generation
  priceRange: {
    // Realistic BTC/JPY price ranges (not hardcoded values)
    min: process.env.TEST_PRICE_MIN || 3000000,
    max: process.env.TEST_PRICE_MAX || 8000000,
    // Safe spread for bid/ask
    spread: process.env.TEST_PRICE_SPREAD || 1000
  },
  
  // Test timeouts
  timeouts: {
    api: parseInt(process.env.TEST_API_TIMEOUT) || 5000,
    websocket: parseInt(process.env.TEST_WS_TIMEOUT) || 10000,
    database: parseInt(process.env.TEST_DB_TIMEOUT) || 3000
  },
  
  // Performance thresholds
  performance: {
    apiResponseTime: parseInt(process.env.TEST_API_RESPONSE_TIME) || 1000,
    wsConnectionTime: parseInt(process.env.TEST_WS_CONNECTION_TIME) || 1000,
    dbQueryTime: parseInt(process.env.TEST_DB_QUERY_TIME) || 500,
    memoryLimit: parseInt(process.env.TEST_MEMORY_LIMIT) || 50 * 1024 * 1024
  },
  
  // Security settings
  security: {
    // Input validation ranges
    validation: {
      maxPriceValue: 100000000, // 100M JPY max
      minPriceValue: 100000,    // 100K JPY min
      maxStringLength: 255,
      allowedCharacters: /^[a-zA-Z0-9\s\-_\.]+$/
    },
    
    // Rate limiting for tests
    rateLimiting: {
      maxRequestsPerMinute: 60,
      burstLimit: 10
    }
  },
  
  // Database configuration
  database: {
    // Always use memory database for tests unless explicitly overridden
    path: process.env.NODE_ENV === 'test' ? ':memory:' : process.env.TEST_DB_PATH,
    // Prevent accidental production database access
    allowProductionAccess: false
  }
};