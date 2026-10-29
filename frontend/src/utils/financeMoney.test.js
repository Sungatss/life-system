import assert from 'node:assert/strict';
import { test } from 'node:test';
import { amountText, money, toBalanceMinor, toMinor } from './financeMoney.js';

test('money inputs preserve minor units and round trip without floating arithmetic', () => {
  for (const minor of [1, 10, 101, 125000, 9000000, 9999999999999, 10000000000000]) {
    assert.equal(toMinor(amountText(minor)), minor);
  }
  assert.equal(toMinor('1 250,05'), 125005);
  assert.equal(toMinor('0.29'), 29);
  assert.equal(money(125000), '1,250 ₸');
  assert.equal(money(-10001), '−100.01 ₸');
});

test('financial inputs reject ambiguous, negative, nonfinite, and overprecision values', () => {
  for (const value of ['', '0', '-1', '1e3', 'NaN', 'Infinity', '100.001', '1,000.50', '100000000000.01']) {
    assert.throws(() => toMinor(value), Error, value);
  }
  assert.equal(toBalanceMinor('0,00'), 0);
  assert.equal(toBalanceMinor('-100.01', true), -10001);
  assert.throws(() => toBalanceMinor('-100.01'));
});
