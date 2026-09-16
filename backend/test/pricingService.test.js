import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePricing } from '../src/services/pricingService.js';

const config = {
  tiers: {
    Silver: { pricePaisa: 10000, available: true },
    Gold: { pricePaisa: 20000, available: true },
    Recliner: { pricePaisa: 30000, available: false }
  },
  festivalDiscountPaisa: 500,
  memberDiscountPercent: 10,
  memberDiscountCapPaisa: 1000,
  convenienceFeePaisaPerTicket: 125,
  gstPercent: 18
};

test('calculates a single ticket tier', () => {
  const bill = calculatePricing({
    tickets: { Silver: 1 },
    config: { ...config, festivalDiscountPaisa: 0, gstPercent: 0 }
  });

  assert.equal(bill.totalTickets, 1);
  assert.equal(bill.baseTicketTotalPaisa, 10000);
  assert.equal(bill.finalTotalPaisa, 10125);
});

test('calculates multiple ticket tiers with a complete bill breakdown', () => {
  const bill = calculatePricing({
    tickets: { Silver: 2, Gold: 1 },
    isMember: true,
    config
  });

  assert.deepEqual(bill.tickets, [
    { tier: 'Silver', quantity: 2, unitPricePaisa: 10000, totalPaisa: 20000 },
    { tier: 'Gold', quantity: 1, unitPricePaisa: 20000, totalPaisa: 20000 }
  ]);
  assert.equal(bill.baseTicketTotalPaisa, 40000);
  assert.equal(bill.festivalDiscountPaisa, 500);
  assert.equal(bill.memberDiscountPaisa, 1000);
  assert.equal(bill.discountedTicketTotalPaisa, 38500);
  assert.equal(bill.convenienceFeePaisa, 375);
  assert.equal(bill.taxableTotalPaisa, 38875);
  assert.equal(bill.gstPaisa, 6998);
  assert.equal(bill.finalTotalPaisa, 45873);
});

test('applies the festival discount without a member discount', () => {
  const bill = calculatePricing({
    tickets: { Silver: 1 },
    config: { ...config, memberDiscountPercent: 0, memberDiscountCapPaisa: 0, gstPercent: 0 }
  });

  assert.equal(bill.baseTicketTotalPaisa, 10000);
  assert.equal(bill.festivalDiscountPaisa, 500);
  assert.equal(bill.memberDiscountPaisa, 0);
  assert.equal(bill.finalTotalPaisa, 9625);
});

test('applies and caps the member percentage discount', () => {
  const bill = calculatePricing({
    tickets: { Silver: 1 },
    isMember: true,
    config: {
      ...config,
      festivalDiscountPaisa: 0,
      memberDiscountPercent: 33.333,
      memberDiscountCapPaisa: 10000,
      convenienceFeePaisaPerTicket: 0,
      gstPercent: 0
    }
  });

  assert.equal(bill.memberDiscountPaisa, 3333);
  assert.equal(bill.finalTotalPaisa, 6667);
});

test('applies festival and member discounts in order', () => {
  const bill = calculatePricing({
    tickets: { Silver: 1 },
    isMember: true,
    config: {
      ...config,
      festivalDiscountPaisa: 1000,
      memberDiscountPercent: 10,
      memberDiscountCapPaisa: 10000,
      convenienceFeePaisaPerTicket: 0,
      gstPercent: 0
    }
  });

  assert.equal(bill.baseTicketTotalPaisa, 10000);
  assert.equal(bill.festivalDiscountPaisa, 1000);
  assert.equal(bill.memberDiscountPaisa, 900);
  assert.equal(bill.finalTotalPaisa, 8100);
});

test('calculates convenience fees per ticket and GST on the taxable total', () => {
  const bill = calculatePricing({
    tickets: { Silver: 2 },
    config: {
      ...config,
      festivalDiscountPaisa: 0,
      memberDiscountPercent: 0,
      convenienceFeePaisaPerTicket: 125,
      gstPercent: 18
    }
  });

  assert.equal(bill.convenienceFeePaisa, 250);
  assert.equal(bill.taxableTotalPaisa, 20250);
  assert.equal(bill.gstPaisa, 3645);
  assert.equal(bill.finalTotalPaisa, 23895);
});

test('rounds percentage calculations to the nearest paisa', () => {
  const bill = calculatePricing({
    tickets: { Silver: 1 },
    config: {
      ...config,
      festivalDiscountPaisa: 0,
      memberDiscountPercent: 12.5,
      memberDiscountCapPaisa: 10000,
      convenienceFeePaisaPerTicket: 0,
      gstPercent: 0
    },
    isMember: true
  });

  assert.equal(bill.memberDiscountPaisa, 1250);
  assert.equal(bill.finalTotalPaisa, 8750);
});

test('rejects zero quantities, sold-out tiers, and insufficient availability', () => {
  assert.throws(
    () => calculatePricing({ tickets: { Silver: 0 }, config }),
    /At least one ticket is required/
  );
  assert.throws(
    () => calculatePricing({ tickets: { Recliner: 1 }, config }),
    /Recliner tier is sold out/
  );
  assert.throws(
    () => calculatePricing({
      tickets: { Silver: 3 },
      config: {
        ...config,
        tiers: { ...config.tiers, Silver: { ...config.tiers.Silver, availableQuantity: 2 } }
      }
    }),
    /Silver has insufficient availability: requested 3, available 2/
  );
});

test('rejects invalid quantities and unknown tiers', () => {
  assert.throws(
    () => calculatePricing({ tickets: { Silver: 1.5 }, config }),
    /Silver quantity must be a non-negative integer/
  );
  assert.throws(
    () => calculatePricing({ tickets: { Balcony: 1 }, config }),
    /Unknown ticket tier: Balcony/
  );
});