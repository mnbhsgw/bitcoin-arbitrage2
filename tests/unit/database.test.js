// Mock sqlite3 before requiring Database
const mockDb = {
  serialize: jest.fn((callback) => callback()),
  run: jest.fn(),
  prepare: jest.fn(),
  all: jest.fn(),
  close: jest.fn()
};

jest.mock('sqlite3', () => ({
  verbose: () => ({
    Database: jest.fn(() => mockDb)
  })
}));

const Database = require('../../server/database');
const sqlite3 = require('sqlite3');

describe('Database', () => {
  let database;

  beforeEach(() => {
    // Clear mocks but don't reset the sqlite3.verbose().Database mock
    mockDb.serialize.mockClear();
    mockDb.run.mockClear();
    mockDb.prepare.mockClear();
    mockDb.all.mockClear();
    mockDb.close.mockClear();
    
    // Reset mock implementations
    mockDb.serialize.mockImplementation((callback) => callback());
    mockDb.run.mockImplementation(() => {});
    mockDb.prepare.mockImplementation(() => ({
      run: jest.fn((params, callback) => callback && callback()),
      finalize: jest.fn((callback) => callback && callback())
    }));
    mockDb.all.mockImplementation(() => {});
    mockDb.close.mockImplementation(() => {});
    
    database = new Database();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize database instance', () => {
      // Database instance should be created
      expect(database).toBeDefined();
      expect(database).toBeInstanceOf(Database);
    });

    it('should call init method', () => {
      expect(mockDb.serialize).toHaveBeenCalled();
    });
  });

  describe('init', () => {
    it('should create required tables', () => {
      // Check if CREATE TABLE statements were called
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS price_history')
      );
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS arbitrage_opportunities')
      );
    });

    it('should handle table info query errors', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock table info to return error
      mockDb.all.mockImplementation((query, callback) => {
        if (query.includes('PRAGMA table_info')) {
          callback(new Error('Table info error'));
        }
      });
      
      database.init();
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error checking table info:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });

    it('should add missing columns to price_history table', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Mock table info to return columns without bid/ask
      mockDb.all.mockImplementation((query, callback) => {
        if (query.includes('PRAGMA table_info(price_history)')) {
          callback(null, [
            { name: 'id' },
            { name: 'exchange' },
            { name: 'price' },
            { name: 'timestamp' },
            { name: 'created_at' }
          ]);
        }
      });
      
      // Mock successful ALTER TABLE
      mockDb.run.mockImplementation((query, callback) => {
        if (query.includes('ALTER TABLE') && callback) {
          callback();
        }
      });
      
      database.init();
      
      expect(mockDb.run).toHaveBeenCalledWith('ALTER TABLE price_history ADD COLUMN bid REAL', expect.any(Function));
      expect(mockDb.run).toHaveBeenCalledWith('ALTER TABLE price_history ADD COLUMN ask REAL', expect.any(Function));
      expect(consoleLogSpy).toHaveBeenCalledWith('Added bid column to price_history table');
      expect(consoleLogSpy).toHaveBeenCalledWith('Added ask column to price_history table');
      
      consoleLogSpy.mockRestore();
    });

    it('should handle ALTER TABLE errors', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock table info to return columns without bid/ask
      mockDb.all.mockImplementation((query, callback) => {
        if (query.includes('PRAGMA table_info(price_history)')) {
          callback(null, [
            { name: 'id' },
            { name: 'exchange' },
            { name: 'price' },
            { name: 'timestamp' }
          ]);
        }
      });
      
      // Mock ALTER TABLE to return error
      mockDb.run.mockImplementation((query, callback) => {
        if (query.includes('ALTER TABLE') && callback) {
          callback(new Error('ALTER TABLE error'));
        }
      });
      
      database.init();
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error adding bid column:', expect.any(Error));
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error adding ask column:', expect.any(Error));
      
      consoleErrorSpy.mockRestore();
    });

    it('should add missing columns to arbitrage_opportunities table', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Mock table info to return columns without fee-related columns
      mockDb.all.mockImplementation((query, callback) => {
        if (query.includes('PRAGMA table_info(arbitrage_opportunities)')) {
          callback(null, [
            { name: 'id' },
            { name: 'exchange_from' },
            { name: 'exchange_to' },
            { name: 'price_difference' }
          ]);
        }
      });
      
      // Mock successful ALTER TABLE
      mockDb.run.mockImplementation((query, callback) => {
        if (query.includes('ALTER TABLE') && callback) {
          callback();
        }
      });
      
      database.init();
      
      expect(mockDb.run).toHaveBeenCalledWith('ALTER TABLE arbitrage_opportunities ADD COLUMN net_profit REAL', expect.any(Function));
      expect(mockDb.run).toHaveBeenCalledWith('ALTER TABLE arbitrage_opportunities ADD COLUMN net_profit_percentage REAL', expect.any(Function));
      expect(mockDb.run).toHaveBeenCalledWith('ALTER TABLE arbitrage_opportunities ADD COLUMN total_fees REAL', expect.any(Function));
      expect(mockDb.run).toHaveBeenCalledWith('ALTER TABLE arbitrage_opportunities ADD COLUMN is_profitable_after_fees BOOLEAN', expect.any(Function));
      
      consoleLogSpy.mockRestore();
    });

    it('should handle arbitrage_opportunities table info query errors', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock table info to return error for arbitrage_opportunities
      mockDb.all.mockImplementation((query, callback) => {
        if (query.includes('PRAGMA table_info(arbitrage_opportunities)')) {
          callback(new Error('Arbitrage table info error'));
        } else if (query.includes('PRAGMA table_info(price_history)')) {
          callback(null, [{ name: 'bid' }, { name: 'ask' }]); // Already has columns
        }
      });
      
      database.init();
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error checking arbitrage_opportunities table info:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });

  describe('savePrices', () => {
    beforeEach(() => {
      const mockStmt = {
        run: jest.fn((params, callback) => {
          if (callback) callback();
        }),
        finalize: jest.fn((callback) => {
          if (callback) callback();
        })
      };
      mockDb.prepare.mockReturnValue(mockStmt);
      mockDb.run.mockImplementation((query, callback) => {
        if (callback) callback();
      });
    });

    it('should save prices to database', async () => {
      const prices = [
        {
          exchange: 'Test Exchange',
          price: 5000000,
          bid: 4999000,
          ask: 5001000,
          timestamp: '2023-01-01T00:00:00Z'
        }
      ];

      await database.savePrices(prices);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'INSERT INTO price_history (exchange, price, bid, ask, timestamp) VALUES (?, ?, ?, ?, ?)'
      );
    });

    it('should handle empty prices array', async () => {
      await expect(database.savePrices([])).resolves.toBeUndefined();
    });

    it('should use transaction for multiple prices', async () => {
      // Clear previous calls from init
      mockDb.run.mockClear();
      
      const prices = [
        { exchange: 'Exchange1', price: 5000000, bid: 4999000, ask: 5001000, timestamp: '2023-01-01T00:00:00Z' },
        { exchange: 'Exchange2', price: 5100000, bid: 5099000, ask: 5101000, timestamp: '2023-01-01T00:00:00Z' }
      ];

      await database.savePrices(prices);

      expect(mockDb.run).toHaveBeenCalledWith('BEGIN TRANSACTION');
      expect(mockDb.run).toHaveBeenCalledWith('COMMIT', expect.any(Function));
    });

    it('should rollback transaction on error', async () => {
      const mockStmt = {
        run: jest.fn((params, callback) => {
          callback(new Error('Insert error'));
        }),
        finalize: jest.fn()
      };
      mockDb.prepare.mockReturnValue(mockStmt);
      mockDb.run.mockImplementation((query, callback) => {
        if (callback) callback();
      });

      const prices = [
        { exchange: 'Exchange1', price: 5000000, bid: 4999000, ask: 5001000, timestamp: '2023-01-01T00:00:00Z' }
      ];

      await expect(database.savePrices(prices)).rejects.toThrow('Insert error');
      expect(mockDb.run).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should handle finalize error', async () => {
      const mockStmt = {
        run: jest.fn((params, callback) => {
          callback();
        }),
        finalize: jest.fn((callback) => {
          callback(new Error('Finalize error'));
        })
      };
      mockDb.prepare.mockReturnValue(mockStmt);
      mockDb.run.mockImplementation((query, callback) => {
        if (callback) callback();
      });

      const prices = [
        { exchange: 'Exchange1', price: 5000000, bid: 4999000, ask: 5001000, timestamp: '2023-01-01T00:00:00Z' }
      ];

      await expect(database.savePrices(prices)).rejects.toThrow('Finalize error');
      expect(mockDb.run).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should handle commit error', async () => {
      const mockStmt = {
        run: jest.fn((params, callback) => {
          callback();
        }),
        finalize: jest.fn((callback) => {
          callback();
        })
      };
      mockDb.prepare.mockReturnValue(mockStmt);
      mockDb.run.mockImplementation((query, callback) => {
        if (query === 'COMMIT' && callback) {
          callback(new Error('Commit error'));
        } else if (callback) {
          callback();
        }
      });

      const prices = [
        { exchange: 'Exchange1', price: 5000000, bid: 4999000, ask: 5001000, timestamp: '2023-01-01T00:00:00Z' }
      ];

      await expect(database.savePrices(prices)).rejects.toThrow('Commit error');
    });
  });

  describe('saveArbitrageOpportunity', () => {
    beforeEach(() => {
      const mockStmt = {
        run: jest.fn((params, callback) => callback()),
        finalize: jest.fn()
      };
      mockDb.prepare.mockReturnValue(mockStmt);
    });

    it('should save arbitrage opportunity to database', async () => {
      const opportunity = {
        exchangeFrom: 'Exchange1',
        exchangeTo: 'Exchange2',
        priceFrom: 5001000,
        priceTo: 5099000,
        priceDifference: 98000,
        percentageDifference: 1.96,
        netProfit: 48000,
        netProfitPercentage: 0.96,
        totalFees: 50000,
        isProfitableAfterFees: false,
        timestamp: '2023-01-01T00:00:00Z'
      };

      await database.saveArbitrageOpportunity(opportunity);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO arbitrage_opportunities')
      );
    });
  });

  describe('getRecentPrices', () => {
    it('should fetch recent prices with default limit', async () => {
      const mockPrices = [
        { id: 1, exchange: 'Exchange1', price: 5000000 },
        { id: 2, exchange: 'Exchange2', price: 5100000 }
      ];

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockPrices);
      });

      const result = await database.getRecentPrices();

      expect(mockDb.all).toHaveBeenCalledWith(
        'SELECT * FROM price_history ORDER BY created_at DESC LIMIT ?',
        [100],
        expect.any(Function)
      );
      expect(result).toEqual(mockPrices);
    });

    it('should accept custom limit', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      await database.getRecentPrices(50);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.any(String),
        [50],
        expect.any(Function)
      );
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(error, null);
      });

      await expect(database.getRecentPrices()).rejects.toThrow('Database error');
    });
  });

  describe('getArbitrageHistory', () => {
    it('should fetch arbitrage history with default limit', async () => {
      const mockHistory = [
        { id: 1, exchange_from: 'Exchange1', exchange_to: 'Exchange2' }
      ];

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockHistory);
      });

      const result = await database.getArbitrageHistory();

      expect(mockDb.all).toHaveBeenCalledWith(
        'SELECT * FROM arbitrage_opportunities ORDER BY created_at DESC LIMIT ?',
        [50],
        expect.any(Function)
      );
      expect(result).toEqual(mockHistory);
    });
  });

  describe('getPriceHistory', () => {
    it('should fetch price history for specified hours', async () => {
      const mockHistory = [
        { exchange: 'Exchange1', price: 5000000 }
      ];

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockHistory);
      });

      const result = await database.getPriceHistory(24);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE created_at >= ?'),
        [expect.any(String)],
        expect.any(Function)
      );
      expect(result).toEqual(mockHistory);
    });

    it('should use default 24 hours if not specified', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      await database.getPriceHistory();

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.any(String),
        [expect.any(String)],
        expect.any(Function)
      );
    });
  });

  describe('clearAllData', () => {
    it('should delete all data from both tables', async () => {
      mockDb.run.mockImplementation((query, callback) => {
        if (callback) callback();
      });

      await database.clearAllData();

      expect(mockDb.run).toHaveBeenCalledWith(
        'DELETE FROM price_history',
        expect.any(Function)
      );
      expect(mockDb.run).toHaveBeenCalledWith(
        'DELETE FROM arbitrage_opportunities',
        expect.any(Function)
      );
    });

    it('should handle errors during data clearing', async () => {
      const error = new Error('Delete error');
      mockDb.run.mockImplementation((query, callback) => {
        if (callback) callback(error);
      });

      await expect(database.clearAllData()).rejects.toThrow('Delete error');
    });
  });

  describe('getPrices', () => {
    it('should fetch all prices when no exchange specified', async () => {
      const mockPrices = [
        { id: 1, exchange: 'Exchange1', price: 5000000 },
        { id: 2, exchange: 'Exchange2', price: 5100000 }
      ];

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockPrices);
      });

      const result = await database.getPrices();

      expect(mockDb.all).toHaveBeenCalledWith(
        'SELECT * FROM price_history ORDER BY created_at DESC',
        [],
        expect.any(Function)
      );
      expect(result).toEqual(mockPrices);
    });

    it('should fetch prices for specific exchange', async () => {
      const mockPrices = [
        { id: 1, exchange: 'Exchange1', price: 5000000 }
      ];

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockPrices);
      });

      const result = await database.getPrices('Exchange1');

      expect(mockDb.all).toHaveBeenCalledWith(
        'SELECT * FROM price_history WHERE exchange = ? ORDER BY created_at DESC',
        ['Exchange1'],
        expect.any(Function)
      );
      expect(result).toEqual(mockPrices);
    });

    it('should handle database errors in getPrices', async () => {
      const error = new Error('Database error');
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(error, null);
      });

      await expect(database.getPrices()).rejects.toThrow('Database error');
    });
  });

  describe('close', () => {
    it('should close database connection', () => {
      database.close();
      expect(mockDb.close).toHaveBeenCalled();
    });
  });
});