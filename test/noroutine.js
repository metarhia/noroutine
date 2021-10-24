'use strict';

const metatests = require('metatests');
const noroutine = require('..');
const module1 = require('./module1.js');

noroutine.init({
  module: module1,
  pool: 5,
  wait: 2000,
  timeout: 5000,
  monitoring: 5000,
});

metatests.test('Noroutine.init', async (test) => {
  const res = await module1.method1('value');
  test.strictSame(res, { key: 'value' });
  test.end();
  noroutine.finalize();
});
