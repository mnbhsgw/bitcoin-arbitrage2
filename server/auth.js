const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

class AuthManager {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-this';
    this.adminUsername = process.env.ADMIN_USERNAME || 'admin';
    this.adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    console.log('Auth initialized with username:', this.adminUsername);
    console.log('Auth initialized with password:', this.adminPassword ? '[SET]' : '[NOT SET]');
  }

  hashPassword(password) {
    return bcrypt.hashSync(password, 10);
  }

  verifyPassword(password, hash) {
    return bcrypt.compareSync(password, hash);
  }

  generateToken(username) {
    return jwt.sign(
      { username, role: 'admin', iat: Date.now() },
      this.jwtSecret,
      { expiresIn: '24h' }
    );
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      return null;
    }
  }

  authenticate(username, password) {
    console.log('Authentication attempt:', { username, password: password ? '[PROVIDED]' : '[MISSING]' });
    console.log('Expected username:', this.adminUsername);
    
    if (username === this.adminUsername && password === this.adminPassword) {
      console.log('Authentication successful');
      return this.generateToken(username);
    }
    console.log('Authentication failed');
    return null;
  }

  // Middleware function for protecting routes
  requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = this.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = decoded;
    next();
  }

  // WebSocket authentication
  authenticateWebSocket(token) {
    if (!token) return false;
    const decoded = this.verifyToken(token);
    return decoded !== null;
  }
}

module.exports = AuthManager;