# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start both server and client in development mode concurrently
- `npm run server` - Start only the Node.js server with nodemon (port 3001)
- `npm run client` - Start only the React client (port 3000)
- `npm run install-deps` - Install dependencies for both root and client directories
- `npm run build` - Build the React client for production

### Testing
- `npm test` - Run unit tests (server-side components)
- `node tests/test-runner.js unit` - Run unit tests explicitly
- `node tests/test-runner.js security` - Run security tests (input validation, SQL injection, auth)
- `node tests/test-runner.js integration` - Run integration tests (requires server running)
- `node tests/test-runner.js performance` - Run performance tests
- `node tests/test-runner.js coverage` - Run tests with coverage report
- `cd client && npm test` - Run React tests with Jest

### Security Testing
The codebase includes comprehensive security tests covering:
- Input validation and sanitization
- SQL injection protection
- Authentication and authorization
- Rate limiting and CORS
- Security headers validation
- WebSocket security

## Architecture

This is a Bitcoin arbitrage monitoring web application with a real-time client-server architecture:

### Backend (Node.js/Express)
- **Server entry point**: `server/index.js` - Main server with WebSocket and HTTP endpoints
- **Exchange APIs**: `server/exchanges.js` - Fetches BTC/JPY prices from bitFlyer, Coincheck, Zaif, GMOコイン, bitbank, and BITPoint
- **Arbitrage detection**: `server/arbitrage.js` - Detects price differences >1% between exchanges
- **Database**: `server/database.js` - SQLite database for price history and arbitrage opportunities
- **Real-time updates**: WebSocket broadcasting price updates every 5 seconds
- **Security**: Input validation, SQL injection protection, rate limiting, authentication

### Frontend (React)
- **Main component**: `client/src/App.js` - Single-page app with WebSocket connection
- **Proxy setup**: Client proxies API requests to `http://localhost:3001`
- **Real-time UI**: WebSocket connection for live price updates and arbitrage notifications

### Key Data Flow
1. Server fetches prices from 6 exchanges every 5 seconds
2. ArbitrageDetector analyzes price differences (threshold: 1%)
3. Database stores all prices and detected opportunities
4. WebSocket broadcasts updates to connected React clients
5. Client displays real-time prices and arbitrage opportunities

### Configuration
- Arbitrage threshold: 1% (configurable in `server/arbitrage.js:16`)
- Price fetch interval: 5 seconds (configurable in `server/index.js:115`)
- Database file: `server/arbitrage.db` (SQLite)
- Test configuration: `tests/config/test-config.js` - Centralized test settings
- Environment variables: `.env.test` - Test environment isolation

### API Endpoints
- `GET /api/prices` - Current prices and opportunities
- `GET /api/history` - Historical price and arbitrage data

### Security Features
- **Input Validation**: All user inputs are validated and sanitized
- **SQL Injection Protection**: Parameterized queries prevent SQL injection
- **Authentication**: JWT-based authentication for admin endpoints
- **Rate Limiting**: API rate limiting to prevent abuse
- **CORS**: Properly configured Cross-Origin Resource Sharing
- **Security Headers**: Helmet.js for security headers (X-Frame-Options, CSP, etc.)
- **Environment Isolation**: Test environment completely separated from production

### Test Structure
- **Unit Tests**: `tests/unit/` - Component-level testing
- **Security Tests**: `tests/security/` - Security vulnerability testing
- **Integration Tests**: `tests/integration/` - End-to-end API testing
- **Performance Tests**: `tests/performance/` - Load and performance testing
- **Test Coverage**: Minimum 80-85% coverage threshold for all code metrics