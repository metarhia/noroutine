'use strict';

const metatests = require('metatests');
const noroutine = require('..');

metatests.test('Noroutine.init', async (test) => {
  noroutine.init({
    module: './module1.js',
    pool: 5,
    wait: 2000,
    timeout: 5000,
  });
  test.strictSame(typeof noroutine, 'object');
  test.end();
});
