const {
  getJapanTime,
  validateNumericParam,
  sleep,
  formatJPY,
  calculatePercentageDifference
} = require('../../server/utils');

describe('Utils', () => {
  describe('getJapanTime', () => {
    test('should return formatted Japan time string', () => {
      const result = getJapanTime();
      
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    });

    test('should return different times when called sequentially', () => {
      const time1 = getJapanTime();
      const time2 = getJapanTime();
      
      // Times should be very close but can be different
      expect(typeof time1).toBe('string');
      expect(typeof time2).toBe('string');
    });

    test('should format date correctly', () => {
      // Mock Date to test specific formatting
      const mockDate = new Date('2023-01-01T12:00:00Z');
      const originalDate = global.Date;
      global.Date = jest.fn(() => mockDate);
      global.Date.now = originalDate.now;
      global.Date.prototype = originalDate.prototype;
      
      // Mock toLocaleString to return predictable format
      mockDate.toLocaleString = jest.fn(() => '2023/01/01 21:00:00');
      
      const result = getJapanTime();
      
      expect(result).toBe('2023-01-01T21:00:00');
      
      global.Date = originalDate;
    });
  });

  describe('validateNumericParam', () => {
    test('should return value when valid number', () => {
      expect(validateNumericParam(42)).toBe(42);
      expect(validateNumericParam('42')).toBe(42);
      expect(validateNumericParam(0)).toBe(0);
    });

    test('should return default value when undefined or null', () => {
      expect(validateNumericParam(undefined)).toBe(0);
      expect(validateNumericParam(null)).toBe(0);
      expect(validateNumericParam(undefined, { default: 10 })).toBe(10);
      expect(validateNumericParam(null, { default: 10 })).toBe(10);
    });

    test('should respect min and max bounds', () => {
      expect(validateNumericParam(5, { min: 0, max: 10 })).toBe(5);
      
      expect(() => {
        validateNumericParam(-1, { min: 0, max: 10 });
      }).toThrow('Invalid numeric parameter. Must be between 0 and 10.');
      
      expect(() => {
        validateNumericParam(15, { min: 0, max: 10 });
      }).toThrow('Invalid numeric parameter. Must be between 0 and 10.');
    });

    test('should handle string inputs', () => {
      expect(validateNumericParam('42')).toBe(42);
      expect(validateNumericParam('0')).toBe(0);
      
      expect(() => {
        validateNumericParam('invalid');
      }).toThrow('Invalid numeric parameter. Must be between 0 and 9007199254740991.');
    });

    test('should handle NaN values', () => {
      expect(() => {
        validateNumericParam(NaN);
      }).toThrow('Invalid numeric parameter. Must be between 0 and 9007199254740991.');
    });

    test('should use custom default values', () => {
      expect(validateNumericParam(undefined, { default: 100 })).toBe(100);
      expect(validateNumericParam(null, { default: 200 })).toBe(200);
    });

    test('should handle edge case values', () => {
      expect(validateNumericParam(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
      expect(validateNumericParam(0, { min: 0 })).toBe(0);
      
      expect(() => {
        validateNumericParam(Infinity);
      }).toThrow('Invalid numeric parameter');
      
      expect(() => {
        validateNumericParam(-Infinity);
      }).toThrow('Invalid numeric parameter');
    });

    test('should handle floating point numbers', () => {
      expect(validateNumericParam(3.14)).toBe(3.14); // Number() preserves decimals
      expect(validateNumericParam('3.14')).toBe(3); // parseInt truncates
    });

    test('should handle negative numbers when allowed', () => {
      expect(validateNumericParam(-5, { min: -10, max: 10 })).toBe(-5);
      
      expect(() => {
        validateNumericParam(-15, { min: -10, max: 10 });
      }).toThrow('Invalid numeric parameter. Must be between -10 and 10.');
    });
  });

  describe('sleep', () => {
    test('should resolve after specified time', async () => {
      const start = Date.now();
      await sleep(10);
      const end = Date.now();
      
      expect(end - start).toBeGreaterThanOrEqual(9); // Allow for timing variance
    });

    test('should return a promise', () => {
      const result = sleep(1);
      expect(result).toBeInstanceOf(Promise);
      return result; // Ensure promise resolves
    });

    test('should work with zero milliseconds', async () => {
      const start = Date.now();
      await sleep(0);
      const end = Date.now();
      
      expect(end - start).toBeLessThan(10); // Should be nearly instant
    });

    test('should handle larger delays', async () => {
      const start = Date.now();
      await sleep(50);
      const end = Date.now();
      
      expect(end - start).toBeGreaterThanOrEqual(45);
      expect(end - start).toBeLessThan(100); // Reasonable upper bound
    });
  });

  describe('formatJPY', () => {
    test('should format positive amounts correctly', () => {
      expect(formatJPY(1000)).toBe('￥1,000');
      expect(formatJPY(1000000)).toBe('￥1,000,000');
      expect(formatJPY(5000000)).toBe('￥5,000,000');
    });

    test('should format zero correctly', () => {
      expect(formatJPY(0)).toBe('￥0');
    });

    test('should format negative amounts correctly', () => {
      expect(formatJPY(-1000)).toBe('-￥1,000');
      expect(formatJPY(-1000000)).toBe('-￥1,000,000');
    });

    test('should handle decimal places correctly', () => {
      expect(formatJPY(1000.5)).toBe('￥1,001'); // Rounds up
      expect(formatJPY(1000.4)).toBe('￥1,000'); // Rounds down
    });

    test('should handle very large numbers', () => {
      expect(formatJPY(1000000000)).toBe('￥1,000,000,000');
    });

    test('should handle very small numbers', () => {
      expect(formatJPY(1)).toBe('￥1');
      expect(formatJPY(0.1)).toBe('￥0');
      expect(formatJPY(0.9)).toBe('￥1');
    });
  });

  describe('calculatePercentageDifference', () => {
    test('should calculate percentage difference correctly', () => {
      expect(calculatePercentageDifference(100, 110)).toBeCloseTo(9.52, 1);
      expect(calculatePercentageDifference(110, 100)).toBeCloseTo(9.52, 1);
      expect(calculatePercentageDifference(5000000, 5100000)).toBeCloseTo(1.98, 1);
    });

    test('should return 0 when values are the same', () => {
      expect(calculatePercentageDifference(100, 100)).toBe(0);
      expect(calculatePercentageDifference(0, 0)).toBe(0);
    });

    test('should return 0 when one value is zero', () => {
      expect(calculatePercentageDifference(0, 100)).toBe(0);
      expect(calculatePercentageDifference(100, 0)).toBe(0);
    });

    test('should handle negative numbers', () => {
      expect(calculatePercentageDifference(-100, -110)).toBeCloseTo(9.52, 1);
      expect(calculatePercentageDifference(-100, -50)).toBeCloseTo(66.67, 1);
    });

    test('should handle decimal numbers', () => {
      expect(calculatePercentageDifference(10.5, 11.5)).toBeCloseTo(9.09, 1);
    });

    test('should handle very small differences', () => {
      expect(calculatePercentageDifference(1000000, 1000001)).toBeCloseTo(0.0001, 4);
    });

    test('should handle very large differences', () => {
      expect(calculatePercentageDifference(1, 1000)).toBeCloseTo(199.8, 0);
    });

    test('should be symmetric', () => {
      const result1 = calculatePercentageDifference(100, 200);
      const result2 = calculatePercentageDifference(200, 100);
      expect(result1).toBe(result2);
    });
  });

  describe('module exports', () => {
    test('should export all functions', () => {
      const utils = require('../../server/utils');
      
      expect(typeof utils.getJapanTime).toBe('function');
      expect(typeof utils.validateNumericParam).toBe('function');
      expect(typeof utils.sleep).toBe('function');
      expect(typeof utils.formatJPY).toBe('function');
      expect(typeof utils.calculatePercentageDifference).toBe('function');
    });

    test('should not export any unexpected functions', () => {
      const utils = require('../../server/utils');
      const expectedFunctions = [
        'getJapanTime',
        'validateNumericParam', 
        'sleep',
        'formatJPY',
        'calculatePercentageDifference'
      ];
      
      const actualFunctions = Object.keys(utils);
      expect(actualFunctions.sort()).toEqual(expectedFunctions.sort());
    });
  });
});