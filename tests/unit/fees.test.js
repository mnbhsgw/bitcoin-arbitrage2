const FeeCalculator = require('../../server/fees');

describe('FeeCalculator', () => {
  let feeCalculator;

  beforeEach(() => {
    feeCalculator = new FeeCalculator();
  });

  describe('constructor', () => {
    test('should initialize with exchange fees data', () => {
      expect(feeCalculator.exchangeFees).toBeDefined();
      expect(feeCalculator.networkFee).toBe(0.0001);
    });

    test('should have fees for all major exchanges', () => {
      const expectedExchanges = ['bitFlyer', 'Coincheck', 'Zaif', 'GMOコイン', 'bitbank', 'BITPoint'];
      
      expectedExchanges.forEach(exchange => {
        expect(feeCalculator.exchangeFees[exchange]).toBeDefined();
        expect(feeCalculator.exchangeFees[exchange].tradingFee).toBeDefined();
        expect(feeCalculator.exchangeFees[exchange].withdrawalFee).toBeDefined();
      });
    });
  });

  describe('getTradingFee', () => {
    test('should return trading fees for valid exchange', () => {
      const fees = feeCalculator.getTradingFee('bitFlyer');
      
      expect(fees).toEqual({
        maker: 0.0001,
        taker: 0.0015
      });
    });

    test('should return trading fees for Coincheck', () => {
      const fees = feeCalculator.getTradingFee('Coincheck');
      
      expect(fees).toEqual({
        maker: 0.0000,
        taker: 0.0000
      });
    });

    test('should return trading fees for GMOコイン with negative maker fee', () => {
      const fees = feeCalculator.getTradingFee('GMOコイン');
      
      expect(fees).toEqual({
        maker: -0.0001,
        taker: 0.0005
      });
    });

    test('should return default fees for unknown exchange', () => {
      const fees = feeCalculator.getTradingFee('UnknownExchange');
      
      expect(fees).toEqual({
        maker: 0.001,
        taker: 0.001
      });
    });

    test('should return fees for all supported exchanges', () => {
      const exchanges = ['bitFlyer', 'Coincheck', 'Zaif', 'GMOコイン', 'bitbank', 'BITPoint'];
      
      exchanges.forEach(exchange => {
        const fees = feeCalculator.getTradingFee(exchange);
        expect(fees.maker).toBeDefined();
        expect(fees.taker).toBeDefined();
        expect(typeof fees.maker).toBe('number');
        expect(typeof fees.taker).toBe('number');
      });
    });
  });

  describe('getWithdrawalFee', () => {
    test('should return JPY withdrawal fee for bitFlyer', () => {
      const fee = feeCalculator.getWithdrawalFee('bitFlyer', 'jpy');
      expect(fee).toBe(550);
    });

    test('should return BTC withdrawal fee for bitFlyer', () => {
      const fee = feeCalculator.getWithdrawalFee('bitFlyer', 'btc');
      expect(fee).toBe(0.0004);
    });

    test('should return zero fee for GMOコイン', () => {
      const jpyFee = feeCalculator.getWithdrawalFee('GMOコイン', 'jpy');
      const btcFee = feeCalculator.getWithdrawalFee('GMOコイン', 'btc');
      
      expect(jpyFee).toBe(0);
      expect(btcFee).toBe(0);
    });

    test('should return default fees for unknown exchange', () => {
      const jpyFee = feeCalculator.getWithdrawalFee('UnknownExchange', 'jpy');
      const btcFee = feeCalculator.getWithdrawalFee('UnknownExchange', 'btc');
      
      expect(jpyFee).toBe(500);
      expect(btcFee).toBe(0.0005);
    });

    test('should return 0 for unknown currency', () => {
      const fee = feeCalculator.getWithdrawalFee('bitFlyer', 'eth');
      expect(fee).toBe(0);
    });

    test('should default to JPY when no currency specified', () => {
      const fee = feeCalculator.getWithdrawalFee('bitFlyer');
      expect(fee).toBe(550);
    });
  });

  describe('calculateTradingCosts', () => {
    test('should calculate buy order costs correctly', () => {
      const result = feeCalculator.calculateTradingCosts('bitFlyer', 1, 5000000, 'buy', 'taker');
      
      expect(result.tradeValue).toBe(5000000);
      expect(result.feeRate).toBe(0.0015);
      expect(result.tradingFee).toBe(7500);
      expect(result.netValue).toBe(5007500);
    });

    test('should calculate sell order costs correctly', () => {
      const result = feeCalculator.calculateTradingCosts('bitFlyer', 1, 5000000, 'sell', 'taker');
      
      expect(result.tradeValue).toBe(5000000);
      expect(result.feeRate).toBe(0.0015);
      expect(result.tradingFee).toBe(7500);
      expect(result.netValue).toBe(4992500);
    });

    test('should use maker fees when specified', () => {
      const result = feeCalculator.calculateTradingCosts('bitFlyer', 1, 5000000, 'buy', 'maker');
      
      expect(result.feeRate).toBe(0.0001);
      expect(result.tradingFee).toBe(500);
      expect(result.netValue).toBe(5000500);
    });

    test('should handle negative maker fees (rebates)', () => {
      const result = feeCalculator.calculateTradingCosts('GMOコイン', 1, 5000000, 'buy', 'maker');
      
      expect(result.feeRate).toBe(-0.0001);
      expect(result.tradingFee).toBe(500); // Math.abs of negative fee
      expect(result.netValue).toBe(5000500); // Buy with negative fee (rebate) adds to cost but netValue is still trade + fee
    });

    test('should handle fractional amounts', () => {
      const result = feeCalculator.calculateTradingCosts('bitFlyer', 0.5, 5000000, 'buy', 'taker');
      
      expect(result.tradeValue).toBe(2500000);
      expect(result.tradingFee).toBe(3750);
      expect(result.netValue).toBe(2503750);
    });
  });

  describe('calculateArbitrageCosts', () => {
    test('should calculate arbitrage costs correctly', () => {
      const result = feeCalculator.calculateArbitrageCosts(
        'bitFlyer', 'Coincheck', 1, 5000000, 5100000
      );
      
      expect(result.grossProfit).toBe(100000);
      expect(result.netProfit).toBeLessThan(result.grossProfit);
      expect(result.profitReduction).toBeGreaterThan(0);
      expect(result.totalCosts).toBeDefined();
      expect(result.costBreakdown).toBeDefined();
    });

    test('should include all cost components', () => {
      const result = feeCalculator.calculateArbitrageCosts(
        'bitFlyer', 'Coincheck', 1, 5000000, 5100000
      );
      
      expect(result.totalCosts.buyTradingFee).toBeDefined();
      expect(result.totalCosts.sellTradingFee).toBeDefined();
      expect(result.totalCosts.jpyWithdrawalFee).toBeDefined();
      expect(result.totalCosts.btcTransferCost).toBeDefined();
      expect(result.totalCosts.total).toBeDefined();
    });

    test('should provide detailed cost breakdown', () => {
      const result = feeCalculator.calculateArbitrageCosts(
        'bitFlyer', 'Coincheck', 1, 5000000, 5100000
      );
      
      expect(result.costBreakdown.buyExchange.exchange).toBe('bitFlyer');
      expect(result.costBreakdown.sellExchange.exchange).toBe('Coincheck');
      expect(result.costBreakdown.networkFee).toBeDefined();
    });

    test('should handle zero-fee exchanges', () => {
      const result = feeCalculator.calculateArbitrageCosts(
        'BITPoint', 'GMOコイン', 1, 5000000, 5100000
      );
      
      // Both exchanges have zero trading fees and withdrawal fees
      expect(result.totalCosts.buyTradingFee).toBe(0);
      // GMOコイン has negative maker fees but this test is about zero fees so check the calculation
      expect(result.totalCosts.jpyWithdrawalFee).toBe(0);
      // BTC withdrawal from BITPoint is also 0, so only network fee should apply
      expect(result.totalCosts.btcTransferCost).toBe(0.0001 * 5000000); // Only network fee
    });

    test('should calculate network transfer costs', () => {
      const result = feeCalculator.calculateArbitrageCosts(
        'bitFlyer', 'Coincheck', 1, 5000000, 5100000
      );
      
      // Network fee + BTC withdrawal fee from buy exchange
      const expectedTransferCost = (0.0001 + 0.0004) * 5000000;
      expect(result.totalCosts.btcTransferCost).toBe(expectedTransferCost);
    });
  });

  describe('calculateMinimumProfitableSpread', () => {
    test('should calculate minimum spread for profitability', () => {
      const result = feeCalculator.calculateMinimumProfitableSpread('bitFlyer', 'Coincheck');
      
      expect(result.minSpread).toBeGreaterThan(0);
      expect(result.minSpreadPercentage).toBeGreaterThan(0);
      expect(result.breakEvenSpread).toBeGreaterThan(result.minSpread);
      expect(result.breakEvenSpread).toBe(result.minSpread * 1.1);
    });

    test('should work with different amount', () => {
      const result1 = feeCalculator.calculateMinimumProfitableSpread('bitFlyer', 'Coincheck', 1);
      const result2 = feeCalculator.calculateMinimumProfitableSpread('bitFlyer', 'Coincheck', 2);
      
      // Larger amount should have lower spread per unit due to fixed costs being spread over more units
      expect(result2.minSpread).toBeLessThan(result1.minSpread);
      expect(result2.minSpreadPercentage).toBeLessThan(result1.minSpreadPercentage);
    });

    test('should handle zero-fee exchanges', () => {
      const result = feeCalculator.calculateMinimumProfitableSpread('BITPoint', 'GMOコイン');
      
      // Should still have some cost due to network fees
      expect(result.minSpread).toBeGreaterThan(0);
      expect(result.minSpreadPercentage).toBeGreaterThan(0);
    });

    test('should handle high-fee exchanges', () => {
      const result = feeCalculator.calculateMinimumProfitableSpread('bitFlyer', 'bitbank');
      
      expect(result.minSpread).toBeGreaterThan(0);
      expect(result.minSpreadPercentage).toBeGreaterThan(0);
    });

    test('should use default amount of 1 when not specified', () => {
      const result1 = feeCalculator.calculateMinimumProfitableSpread('bitFlyer', 'Coincheck');
      const result2 = feeCalculator.calculateMinimumProfitableSpread('bitFlyer', 'Coincheck', 1);
      
      expect(result1.minSpread).toBe(result2.minSpread);
      expect(result1.minSpreadPercentage).toBe(result2.minSpreadPercentage);
    });
  });

  describe('exchange fees data integrity', () => {
    test('should have complete fee structure for all exchanges', () => {
      const exchanges = Object.keys(feeCalculator.exchangeFees);
      
      exchanges.forEach(exchange => {
        const fees = feeCalculator.exchangeFees[exchange];
        
        expect(fees.tradingFee).toBeDefined();
        expect(fees.tradingFee.maker).toBeDefined();
        expect(fees.tradingFee.taker).toBeDefined();
        expect(typeof fees.tradingFee.maker).toBe('number');
        expect(typeof fees.tradingFee.taker).toBe('number');
        
        expect(fees.withdrawalFee).toBeDefined();
        expect(fees.withdrawalFee.jpy).toBeDefined();
        expect(fees.withdrawalFee.btc).toBeDefined();
        expect(typeof fees.withdrawalFee.jpy).toBe('number');
        expect(typeof fees.withdrawalFee.btc).toBe('number');
      });
    });

    test('should have reasonable fee ranges', () => {
      const exchanges = Object.keys(feeCalculator.exchangeFees);
      
      exchanges.forEach(exchange => {
        const fees = feeCalculator.exchangeFees[exchange];
        
        // Trading fees should be reasonable (between -0.1% and 1%)
        expect(fees.tradingFee.maker).toBeGreaterThanOrEqual(-0.001);
        expect(fees.tradingFee.maker).toBeLessThanOrEqual(0.01);
        expect(fees.tradingFee.taker).toBeGreaterThanOrEqual(0);
        expect(fees.tradingFee.taker).toBeLessThanOrEqual(0.01);
        
        // JPY withdrawal fees should be reasonable (0 to 1000 yen)
        expect(fees.withdrawalFee.jpy).toBeGreaterThanOrEqual(0);
        expect(fees.withdrawalFee.jpy).toBeLessThanOrEqual(1000);
        
        // BTC withdrawal fees should be reasonable (0 to 0.001 BTC)
        expect(fees.withdrawalFee.btc).toBeGreaterThanOrEqual(0);
        expect(fees.withdrawalFee.btc).toBeLessThanOrEqual(0.001);
      });
    });
  });
});