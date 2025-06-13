// Test environment setup - loads before all tests
// This file ensures proper environment isolation

require('dotenv').config({ path: '.env.test' });

// Ensure we're in test environment
process.env.NODE_ENV = 'test';

// Prevent accidental production database access
if (process.env.DB_PATH && process.env.DB_PATH !== ':memory:' && !process.env.DB_PATH.includes('test')) {
  throw new Error('Potential production database access detected in tests. Use TEST_DB_PATH or :memory:');
}

// Override any production environment variables
process.env.DB_PATH = ':memory:';
process.env.TEST_DB_PATH = ':memory:';

// Disable external API calls by default
process.env.SKIP_REAL_API_TESTS = 'true';
process.env.MOCK_EXTERNAL_APIS = 'true';

// Set test-specific ports to avoid conflicts
process.env.PORT = '0'; // Use random available port
process.env.WS_PORT = '0'; // Use random available port

// Enable verbose logging only if explicitly requested
if (process.env.VERBOSE_TESTS !== 'true') {
  process.env.LOG_LEVEL = 'error';
}

// Security: Ensure test secrets are used
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('production')) {
  process.env.JWT_SECRET = 'test_secret_key_for_tests_only_not_for_production';
}

// Validate critical test configuration
const requiredTestVars = [
  'NODE_ENV',
  'TEST_DB_PATH',
  'SKIP_REAL_API_TESTS',
  'JWT_SECRET'
];

for (const varName of requiredTestVars) {
  if (!process.env[varName]) {
    throw new Error(`Required test environment variable ${varName} is not set`);
  }
}

// Ensure test database isolation
if (process.env.NODE_ENV === 'test' && process.env.TEST_DB_PATH !== ':memory:') {
  console.warn('Warning: Test database is not using :memory:, which may cause data persistence issues');
}

console.log('Test environment initialized successfully');
console.log(`Database: ${process.env.TEST_DB_PATH}`);
console.log(`External APIs: ${process.env.SKIP_REAL_API_TESTS === 'true' ? 'Mocked' : 'Real'}`);