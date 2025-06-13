// Jest setup file for Bitcoin Arbitrage monitoring system tests

// Extend Jest matchers
expect.extend({
  toBeValidPriceData(received) {
    const pass = 
      typeof received === 'object' &&
      received !== null &&
      typeof received.exchange === 'string' &&
      typeof received.price === 'number' &&
      received.price > 0 &&
      typeof received.timestamp === 'string';

    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be valid price data`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be valid price data with exchange, price, and timestamp`,
        pass: false,
      };
    }
  },

  toBeValidArbitrageOpportunity(received) {
    const pass = 
      typeof received === 'object' &&
      received !== null &&
      typeof received.exchangeFrom === 'string' &&
      typeof received.exchangeTo === 'string' &&
      typeof received.priceFrom === 'number' &&
      typeof received.priceTo === 'number' &&
      typeof received.priceDifference === 'number' &&
      typeof received.percentageDifference === 'number' &&
      received.percentageDifference > 0;

    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be valid arbitrage opportunity`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be valid arbitrage opportunity`,
        pass: false,
      };
    }
  },

  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  }
});

// Load test configuration from secure config file
const testConfig = require('../config/test-config');

// Global test configuration
global.testConfig = testConfig;

// Mock console methods to reduce noise during testing
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

beforeAll(() => {
  // Only show console output in verbose mode
  if (!process.env.VERBOSE_TESTS) {
    console.error = jest.fn((message) => {
      if (message.includes('API Error') || message.includes('Database error')) {
        // Allow important error messages
        originalConsoleError(message);
      }
    });
    
    console.warn = jest.fn((message) => {
      if (message.includes('API returned null') || message.includes('server not running')) {
        // Allow important warnings
        originalConsoleWarn(message);
      }
    });
    
    console.log = jest.fn();
  }
});

afterAll(() => {
  // Restore console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});

// Clean up after each test
afterEach(() => {
  // Clear any timers
  jest.clearAllTimers();
  
  // Clear all mocks
  jest.clearAllMocks();
});

// Utility functions for tests
global.testUtils = {
  // Generate mock price data with validation
  generateMockPriceData: (exchange = 'TestExchange', basePrice) => {
    const config = global.testConfig;
    const safeName = config.security.validation.allowedCharacters.test(exchange) ? exchange : 'TestExchange';
    const safeBasePrice = basePrice || (config.priceRange.min + Math.random() * (config.priceRange.max - config.priceRange.min));
    
    // Validate price range
    if (safeBasePrice < config.security.validation.minPriceValue || safeBasePrice > config.security.validation.maxPriceValue) {
      throw new Error(`Invalid price range: ${safeBasePrice}`);
    }
    
    const spread = config.priceRange.spread;
    return {
      exchange: safeName,
      price: Math.round(safeBasePrice),
      bid: Math.round(safeBasePrice - spread + Math.random() * (spread / 2)),
      ask: Math.round(safeBasePrice + spread + Math.random() * (spread / 2)),
      timestamp: new Date().toISOString()
    };
  },

  // Generate mock arbitrage opportunity
  generateMockArbitrage: (exchangeFrom = 'Exchange1', exchangeTo = 'Exchange2') => {
    const priceFrom = 5000000 + Math.random() * 50000;
    const priceTo = priceFrom + 50000 + Math.random() * 50000;
    const priceDifference = priceTo - priceFrom;
    const percentageDifference = (priceDifference / priceFrom) * 100;
    
    return {
      exchangeFrom,
      exchangeTo,
      priceFrom,
      priceTo,
      priceDifference,
      percentageDifference,
      timestamp: new Date().toISOString(),
      profit: priceDifference
    };
  },

  // Wait for a condition with timeout
  waitFor: (condition, timeout = 5000, interval = 100) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const check = () => {
        if (condition()) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Condition not met within ${timeout}ms`));
        } else {
          setTimeout(check, interval);
        }
      };
      
      check();
    });
  },

  // Create a delay
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Check if server is running
  isServerRunning: async (url = 'http://localhost:3001') => {
    try {
      const axios = require('axios');
      await axios.get(`${url}/api/prices`, { timeout: 1000 });
      return true;
    } catch (error) {
      return false;
    }
  }
};

// Environment-specific configuration
if (process.env.NODE_ENV === 'test') {
  // Disable real external API calls by default in test environment
  process.env.SKIP_REAL_API_TESTS = process.env.SKIP_REAL_API_TESTS || 'true';
}

// Set up secure test database path
const dbConfig = global.testConfig.database;
if (dbConfig.allowProductionAccess === false && process.env.NODE_ENV !== 'test') {
  throw new Error('Test database access denied in non-test environment');
}
process.env.TEST_DB_PATH = dbConfig.path;

// Increase test timeout for integration tests
jest.setTimeout(30000);