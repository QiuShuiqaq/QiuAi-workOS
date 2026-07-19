import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import {
  formatAmountCny,
  getMissingAlipayEnvKeys,
  isAlipayTradeClosed,
  isAlipayTradePaid,
  normalizeAlipayNotifyBody,
  parseAlipayDecodedBody,
  parseAlipayRawBody
} from './alipay-gateway';

const envSnapshot = { ...process.env };

afterEach(() => {
  process.env = { ...envSnapshot };
});

describe('alipay gateway helpers', () => {
  test('formats cents as CNY amount strings', () => {
    assert.equal(formatAmountCny(1), '0.01');
    assert.equal(formatAmountCny(100), '1.00');
    assert.equal(formatAmountCny(123456), '1234.56');
  });

  test('parses raw and decoded urlencoded notify bodies separately', () => {
    const body = 'out_trade_no=QWOS1&subject=QiuAI+WorkOS&sign=a%2Bb%3D&empty=';

    assert.deepEqual(parseAlipayRawBody(body), {
      out_trade_no: 'QWOS1',
      subject: 'QiuAI+WorkOS',
      sign: 'a%2Bb%3D',
      empty: ''
    });
    assert.deepEqual(parseAlipayDecodedBody(body), {
      out_trade_no: 'QWOS1',
      subject: 'QiuAI WorkOS',
      sign: 'a+b=',
      empty: ''
    });
  });

  test('normalizes object notify bodies into urlencoded strings', () => {
    assert.equal(
      normalizeAlipayNotifyBody({
        out_trade_no: 'QWOS1',
        total_amount: '1.00',
        ignored: 1
      }),
      'out_trade_no=QWOS1&total_amount=1.00'
    );
    assert.equal(normalizeAlipayNotifyBody(undefined), '');
  });

  test('classifies paid and closed trade statuses', () => {
    assert.equal(isAlipayTradePaid('TRADE_SUCCESS'), true);
    assert.equal(isAlipayTradePaid('TRADE_FINISHED'), true);
    assert.equal(isAlipayTradePaid('WAIT_BUYER_PAY'), false);
    assert.equal(isAlipayTradeClosed('TRADE_CLOSED'), true);
    assert.equal(isAlipayTradeClosed('TRADE_SUCCESS'), false);
  });

  test('reports public base url and required secret keys as missing config', () => {
    delete process.env.WORKOS_PUBLIC_BASE_URL;
    delete process.env.APP_BASE_URL;
    delete process.env.PAYMENT_ALIPAY_APP_ID;
    delete process.env.PAYMENT_ALIPAY_PRIVATE_KEY;
    delete process.env.PAYMENT_ALIPAY_PUBLIC_KEY;

    assert.deepEqual(getMissingAlipayEnvKeys(), [
      'WORKOS_PUBLIC_BASE_URL',
      'PAYMENT_ALIPAY_APP_ID',
      'PAYMENT_ALIPAY_PRIVATE_KEY',
      'PAYMENT_ALIPAY_PUBLIC_KEY'
    ]);
  });
});
