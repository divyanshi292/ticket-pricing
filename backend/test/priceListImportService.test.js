import assert from 'node:assert/strict';
import test from 'node:test';
import { importPriceList } from '../src/services/priceListImportService.js';

test('cleans formats, canonicalizes names, and reports duplicates and rejects', () => {
  const report = importPriceList([
    { name: ' silver ', price: '₹1,500.50' },
    { name: 'SILVER', price: '999' },
    { tier: 'Gold', amount: 'Rs. 2,000' },
    { class: 'recliner', price: 3500 },
    { name: 'Gold', price: '' },
    { name: 'Silver', price: '-10' },
    { name: 'Balcony', price: '1000' },
    { name: 'Recliner', price: 'not-a-price' }
  ]);

  assert.deepEqual(report.imported.map(({ tier, pricePaisa }) => ({ tier, pricePaisa })), [
    { tier: 'Silver', pricePaisa: 150050 },
    { tier: 'Gold', pricePaisa: 200000 },
    { tier: 'Recliner', pricePaisa: 350000 }
  ]);
  assert.equal(report.deduplicated.length, 1);
  assert.equal(report.deduplicated[0].canonicalTier, 'Silver');
  assert.equal(report.rejected.length, 4);
  assert.deepEqual(report.summary, {
    received: 8,
    imported: 3,
    deduplicated: 1,
    rejected: 4
  });
});

test('rejects a missing price list', () => {
  assert.throws(() => importPriceList(), /prices must be an array/);
});