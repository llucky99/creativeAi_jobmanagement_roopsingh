const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateInvoice } = require('../src/utils/invoiceCalculator');

test('matches the example from the spec (1000 + 2000 + 500, 10% GST)', () => {
  const r = calculateInvoice({ partsTotal: 1000, serviceCost: 2000, cleaningCost: 500, gstPercent: 10 });
  assert.equal(r.subtotal, 3500);
  assert.equal(r.gstAmount, 350);
  assert.equal(r.finalTotal, 3850);
});

test('handles decimals without floating point drift', () => {
  const r = calculateInvoice({ partsTotal: 0.1 + 0.2, serviceCost: 99.99, cleaningCost: 0.01 });
  assert.equal(r.subtotal, 100.3);
  assert.equal(r.gstAmount, 10.03);
  assert.equal(r.finalTotal, 110.33);
});

test('works with zero parts', () => {
  const r = calculateInvoice({ partsTotal: 0, serviceCost: 100, cleaningCost: 0 });
  assert.equal(r.finalTotal, 110);
});
