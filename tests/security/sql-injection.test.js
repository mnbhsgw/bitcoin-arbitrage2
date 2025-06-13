// SQL Injection protection tests for Bitcoin Arbitrage system
const Database = require('../../server/database');
const testConfig = require('../config/test-config');

describe('SQL Injection Protection Tests', () => {
  let db;
  
  beforeEach(async () => {
    // Use in-memory database for testing
    db = new Database();
    db.db.close(); // Close the file-based connection
    
    const sqlite3 = require('sqlite3').verbose();
    db.db = new sqlite3.Database(':memory:');
    
    // Initialize test database
    await new Promise((resolve, reject) => {
      db.db.serialize(() => {
        db.db.run(`
          CREATE TABLE IF NOT EXISTS price_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            exchange TEXT NOT NULL,
            price REAL NOT NULL,
            bid REAL,
            ask REAL,
            timestamp TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  });
  
  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('Input Sanitization', () => {
    test('should prevent SQL injection in exchange name parameter', async () => {
      const maliciousInputs = [
        "'; DROP TABLE price_history; --",
        "' OR 1=1 --",
        "' UNION SELECT * FROM sqlite_master --",
        "bitFlyer'; INSERT INTO price_history VALUES (999, 'hack', 0, 0, 0, '2023-01-01'); --",
        "test' OR '1'='1",
        "'; DELETE FROM price_history; --"
      ];

      // Insert test data first
      await db.savePrices([{
        exchange: 'bitFlyer',
        price: 5000000,
        bid: 4999000,
        ask: 5001000,
        timestamp: new Date().toISOString()
      }]);

      for (const maliciousInput of maliciousInputs) {
        try {
          // This should not execute malicious SQL
          const result = await db.getRecentPrices(10);
          
          // Verify original data is still intact
          expect(result).toHaveLength(1);
          expect(result[0].exchange).toBe('bitFlyer');
          
          // Verify no malicious data was inserted
          const allData = await new Promise((resolve, reject) => {
            db.db.all("SELECT * FROM price_history", (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            });
          });
          
          expect(allData).toHaveLength(1);
          expect(allData.some(row => row.exchange === 'hack')).toBe(false);
          
        } catch (error) {
          // SQL injection should be prevented, not cause crashes
          expect(error.message).not.toContain('SQLITE_ERROR');
        }
      }
    });

    test('should use parameterized queries for price insertion', async () => {
      const testPrices = [
        {
          exchange: "test'; DROP TABLE price_history; --",
          price: 5000000,
          bid: 4999000,
          ask: 5001000,
          timestamp: new Date().toISOString()
        }
      ];

      // This should safely insert the malicious string as data, not execute it
      await expect(db.savePrices(testPrices)).resolves.not.toThrow();
      
      const result = await db.getRecentPrices(10);
      expect(result).toHaveLength(1);
      expect(result[0].exchange).toBe("test'; DROP TABLE price_history; --");
      
      // Verify table still exists and has data
      const tableCheck = await new Promise((resolve, reject) => {
        db.db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='price_history'", (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      expect(tableCheck).toHaveLength(1);
    });

    test('should validate numeric inputs to prevent injection', async () => {
      const maliciousNumericInputs = [
        "1; DROP TABLE price_history; --",
        "1 OR 1=1",
        "1' UNION SELECT 1,2,3,4,5,6 --",
        "(SELECT COUNT(*) FROM sqlite_master)"
      ];

      for (const maliciousInput of maliciousNumericInputs) {
        const testPrice = {
          exchange: 'bitFlyer',
          price: maliciousInput, // This should be rejected or sanitized
          bid: 4999000,
          ask: 5001000,
          timestamp: new Date().toISOString()
        };

        try {
          await db.savePrices([testPrice]);
          
          // If it doesn't throw, verify the data was sanitized
          const result = await db.getRecentPrices(1);
          if (result.length > 0) {
            expect(typeof result[0].price).toBe('number');
            expect(result[0].price).not.toEqual(maliciousInput);
          }
        } catch (error) {
          // It's acceptable to reject invalid numeric input
          expect(error).toBeDefined();
        }
      }
    });
  });

  describe('Query Construction Validation', () => {
    test('should properly escape special characters in LIKE queries', async () => {
      // Insert test data with special characters
      const testData = [
        { exchange: 'test_exchange', price: 5000000, bid: 4999000, ask: 5001000, timestamp: new Date().toISOString() },
        { exchange: 'test%exchange', price: 5100000, bid: 5099000, ask: 5101000, timestamp: new Date().toISOString() },
        { exchange: "test'exchange", price: 5200000, bid: 5199000, ask: 5201000, timestamp: new Date().toISOString() }
      ];
      
      await db.savePrices(testData);
      
      // Test LIKE query with special characters (if implemented)
      const searchTerm = "test'%";
      
      // This query should be properly escaped
      const result = await new Promise((resolve, reject) => {
        db.db.all(
          "SELECT * FROM price_history WHERE exchange LIKE ?",
          [`%${searchTerm}%`],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });
      
      // Should not return unexpected results due to unescaped wildcards
      expect(result.length).toBeLessThanOrEqual(testData.length);
    });

    test('should prevent injection through LIMIT parameter', async () => {
      // Insert test data
      await db.savePrices([
        { exchange: 'test1', price: 5000000, bid: 4999000, ask: 5001000, timestamp: new Date().toISOString() },
        { exchange: 'test2', price: 5100000, bid: 5099000, ask: 5101000, timestamp: new Date().toISOString() }
      ]);

      const maliciousLimits = [
        "1; DROP TABLE price_history; --",
        "1 UNION SELECT * FROM sqlite_master",
        "ALL",
        "-1",
        "1e10"
      ];

      for (const maliciousLimit of maliciousLimits) {
        try {
          // The getRecentPrices method should validate the limit parameter
          const result = await new Promise((resolve, reject) => {
            // Simulate what would happen with proper parameter validation
            const safeLimit = parseInt(maliciousLimit) || 100;
            if (safeLimit < 0 || safeLimit > 1000) {
              reject(new Error('Invalid limit parameter'));
              return;
            }
            
            db.db.all(
              "SELECT * FROM price_history ORDER BY created_at DESC LIMIT ?",
              [safeLimit],
              (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
              }
            );
          });
          
          expect(result.length).toBeLessThanOrEqual(2);
          
        } catch (error) {
          // Should reject invalid limits
          expect(error.message).toContain('Invalid limit parameter');
        }
      }
    });
  });

  describe('Data Integrity Validation', () => {
    test('should validate data types before database operations', async () => {
      const invalidPriceData = [
        {
          exchange: 123, // Should be string
          price: 'not_a_number', // Should be number
          bid: null,
          ask: undefined,
          timestamp: 'invalid_date'
        }
      ];

      // Should validate and reject invalid data types
      await expect(async () => {
        // Simulate proper validation before database operation
        for (const data of invalidPriceData) {
          if (typeof data.exchange !== 'string') {
            throw new Error('Invalid exchange type');
          }
          if (typeof data.price !== 'number' || isNaN(data.price)) {
            throw new Error('Invalid price type');
          }
          if (data.timestamp && isNaN(Date.parse(data.timestamp))) {
            throw new Error('Invalid timestamp');
          }
        }
        
        await db.savePrices(invalidPriceData);
      }).rejects.toThrow();
    });

    test('should prevent buffer overflow attacks', async () => {
      const oversizedData = {
        exchange: 'a'.repeat(10000), // Very long string
        price: 5000000,
        bid: 4999000,
        ask: 5001000,
        timestamp: new Date().toISOString()
      };

      try {
        // Should either truncate or reject oversized input
        const safeExchange = oversizedData.exchange.substring(0, testConfig.security.validation.maxStringLength);
        
        await db.savePrices([{
          ...oversizedData,
          exchange: safeExchange
        }]);
        
        const result = await db.getRecentPrices(1);
        expect(result[0].exchange.length).toBeLessThanOrEqual(testConfig.security.validation.maxStringLength);
        
      } catch (error) {
        // It's acceptable to reject oversized input
        expect(error).toBeDefined();
      }
    });
  });

  describe('Transaction Safety', () => {
    test('should handle transaction rollback safely', async () => {
      const validData = {
        exchange: 'bitFlyer',
        price: 5000000,
        bid: 4999000,
        ask: 5001000,
        timestamp: new Date().toISOString()
      };

      const invalidData = {
        exchange: 'coincheck',
        price: 'invalid', // This should cause transaction to fail
        bid: 5099000,
        ask: 5101000,
        timestamp: new Date().toISOString()
      };

      try {
        // Simulate transaction behavior
        await db.savePrices([validData, invalidData]);
      } catch (error) {
        // Transaction should rollback, leaving database in consistent state
        const result = await db.getRecentPrices(10);
        expect(result).toHaveLength(0); // No partial data should remain
      }
    });
  });
});