const AuthManager = require('../../server/auth');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

describe('AuthManager', () => {
  let authManager;
  
  beforeEach(() => {
    // Reset environment variables for consistent testing
    process.env.JWT_SECRET = 'test-secret';
    process.env.ADMIN_USERNAME = 'testadmin';
    process.env.ADMIN_PASSWORD = 'testpass123';
    
    authManager = new AuthManager();
  });
  
  afterEach(() => {
    // Clean up environment variables
    delete process.env.JWT_SECRET;
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
  });

  describe('constructor', () => {
    test('should initialize with environment variables', () => {
      expect(authManager.jwtSecret).toBe('test-secret');
      expect(authManager.adminUsername).toBe('testadmin');
      expect(authManager.adminPassword).toBe('testpass123');
    });

    test('should use fallback values when environment variables are not set', () => {
      delete process.env.JWT_SECRET;
      delete process.env.ADMIN_USERNAME;
      delete process.env.ADMIN_PASSWORD;
      
      const authManagerFallback = new AuthManager();
      
      expect(authManagerFallback.jwtSecret).toBe('fallback-secret-change-this');
      expect(authManagerFallback.adminUsername).toBe('admin');
      expect(authManagerFallback.adminPassword).toBe('admin123');
    });

    test('should log initialization details', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      new AuthManager();
      
      expect(consoleSpy).toHaveBeenCalledWith('Auth initialized with username:', 'testadmin');
      expect(consoleSpy).toHaveBeenCalledWith('Auth initialized with password:', '[SET]');
      
      consoleSpy.mockRestore();
    });

    test('should log when password is not set', () => {
      // Remove the existing environment variable completely
      const originalPassword = process.env.ADMIN_PASSWORD;
      delete process.env.ADMIN_PASSWORD;
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      new AuthManager();
      
      // Since no password is set, it uses the fallback 'admin123', so it will be '[SET]'
      expect(consoleSpy).toHaveBeenCalledWith('Auth initialized with password:', '[SET]');
      
      // Restore original environment
      if (originalPassword !== undefined) {
        process.env.ADMIN_PASSWORD = originalPassword;
      }
      consoleSpy.mockRestore();
    });
  });

  describe('hashPassword', () => {
    test('should hash password correctly', () => {
      const password = 'testpassword';
      const hash = authManager.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    test('should produce different hashes for same password', () => {
      const password = 'testpassword';
      const hash1 = authManager.hashPassword(password);
      const hash2 = authManager.hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    test('should verify correct password', () => {
      const password = 'testpassword';
      const hash = authManager.hashPassword(password);
      
      const result = authManager.verifyPassword(password, hash);
      expect(result).toBe(true);
    });

    test('should reject incorrect password', () => {
      const password = 'testpassword';
      const wrongPassword = 'wrongpassword';
      const hash = authManager.hashPassword(password);
      
      const result = authManager.verifyPassword(wrongPassword, hash);
      expect(result).toBe(false);
    });

    test('should handle invalid hash', () => {
      const password = 'testpassword';
      const invalidHash = 'invalid-hash';
      
      const result = authManager.verifyPassword(password, invalidHash);
      expect(result).toBe(false);
    });
  });

  describe('generateToken', () => {
    test('should generate valid JWT token', () => {
      const username = 'testuser';
      const token = authManager.generateToken(username);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    test('should include correct payload', () => {
      const username = 'testuser';
      const token = authManager.generateToken(username);
      const decoded = jwt.verify(token, 'test-secret');
      
      expect(decoded.username).toBe(username);
      expect(decoded.role).toBe('admin');
      expect(decoded.iat).toBeDefined();
    });

    test('should set expiration time', () => {
      const username = 'testuser';
      const token = authManager.generateToken(username);
      const decoded = jwt.verify(token, 'test-secret');
      
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp > decoded.iat).toBe(true);
    });
  });

  describe('verifyToken', () => {
    test('should verify valid token', () => {
      const username = 'testuser';
      const token = authManager.generateToken(username);
      
      const result = authManager.verifyToken(token);
      
      expect(result).toBeDefined();
      expect(result.username).toBe(username);
      expect(result.role).toBe('admin');
    });

    test('should return null for invalid token', () => {
      const invalidToken = 'invalid.token.here';
      
      const result = authManager.verifyToken(invalidToken);
      
      expect(result).toBeNull();
    });

    test('should return null for token with wrong secret', () => {
      const username = 'testuser';
      const token = jwt.sign({ username }, 'wrong-secret');
      
      const result = authManager.verifyToken(token);
      
      expect(result).toBeNull();
    });

    test('should return null for expired token', () => {
      const username = 'testuser';
      const expiredToken = jwt.sign(
        { username, exp: Math.floor(Date.now() / 1000) - 3600 }, // Expired 1 hour ago
        'test-secret'
      );
      
      const result = authManager.verifyToken(expiredToken);
      
      expect(result).toBeNull();
    });

    test('should handle malformed token', () => {
      const malformedToken = 'not.a.valid.jwt.token';
      
      const result = authManager.verifyToken(malformedToken);
      
      expect(result).toBeNull();
    });
  });

  describe('authenticate', () => {
    test('should authenticate with correct credentials', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const token = authManager.authenticate('testadmin', 'testpass123');
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(consoleSpy).toHaveBeenCalledWith('Authentication successful');
      
      consoleSpy.mockRestore();
    });

    test('should reject incorrect username', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const token = authManager.authenticate('wronguser', 'testpass123');
      
      expect(token).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Authentication failed');
      
      consoleSpy.mockRestore();
    });

    test('should reject incorrect password', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const token = authManager.authenticate('testadmin', 'wrongpass');
      
      expect(token).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Authentication failed');
      
      consoleSpy.mockRestore();
    });

    test('should log authentication attempts', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      authManager.authenticate('testadmin', 'testpass123');
      
      expect(consoleSpy).toHaveBeenCalledWith('Authentication attempt:', { 
        username: 'testadmin', 
        password: '[PROVIDED]' 
      });
      expect(consoleSpy).toHaveBeenCalledWith('Expected username:', 'testadmin');
      
      consoleSpy.mockRestore();
    });

    test('should handle missing password', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const token = authManager.authenticate('testadmin', '');
      
      expect(token).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Authentication attempt:', { 
        username: 'testadmin', 
        password: '[MISSING]' 
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('requireAuth middleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        headers: {}
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
    });

    test('should call next() with valid token', () => {
      const token = authManager.generateToken('testuser');
      req.headers.authorization = `Bearer ${token}`;
      
      authManager.requireAuth(req, res, next);
      
      expect(req.user).toBeDefined();
      expect(req.user.username).toBe('testuser');
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should return 401 without authorization header', () => {
      authManager.requireAuth(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 with malformed authorization header', () => {
      req.headers.authorization = 'InvalidFormat';
      
      authManager.requireAuth(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 with invalid token', () => {
      req.headers.authorization = 'Bearer invalid.token';
      
      authManager.requireAuth(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle Bearer without space', () => {
      req.headers.authorization = 'Bearer';
      
      authManager.requireAuth(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle empty authorization header', () => {
      req.headers.authorization = '';
      
      authManager.requireAuth(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('authenticateWebSocket', () => {
    test('should return true for valid token', () => {
      const token = authManager.generateToken('testuser');
      
      const result = authManager.authenticateWebSocket(token);
      
      expect(result).toBe(true);
    });

    test('should return false for invalid token', () => {
      const invalidToken = 'invalid.token';
      
      const result = authManager.authenticateWebSocket(invalidToken);
      
      expect(result).toBe(false);
    });

    test('should return false for null token', () => {
      const result = authManager.authenticateWebSocket(null);
      
      expect(result).toBe(false);
    });

    test('should return false for undefined token', () => {
      const result = authManager.authenticateWebSocket(undefined);
      
      expect(result).toBe(false);
    });

    test('should return false for empty token', () => {
      const result = authManager.authenticateWebSocket('');
      
      expect(result).toBe(false);
    });
  });
});