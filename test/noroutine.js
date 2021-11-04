'use strict';

const metatests = require('metatests');
const metautil = require('metautil');
const noroutine = require('..');
const module1 = require('./module1.js');
const module2 = require('./module2');

noroutine.init({
  modules: [module1, module2],
  pool: 5,
  wait: 2000,
  timeout: 5000,
  monitoring: 5000,
});

metatests.test('Noroutine execute method', async (test) => {
  const res1 = await module1.method1('value1');
  test.strictSame(res1, { key: 'value1' });

  await metautil.delay(2000);

  const res2 = await module1.method1('value2');
  test.strictSame(res2, { key: 'value2' });

  await metautil.delay(2000);

  const res3 = await module1.method1('value3');
  test.strictSame(res3, { key: 'value3' });

  await metautil.delay(2000);

  const res4 = await module2.method3('value4');
  test.strictSame(res4, { key: 'value4' });

  await metautil.delay(2000);

  const res5 = await module2.method4('value5');
  test.strictSame(res5, { key: 'value5' });

  test.end();
  await noroutine.finalize();
});

metatests.test('Wait for timeout and reject execution', async (test) => {
  try {
    await module1.method2('value1');
    test.strictSame(true, false);
  } catch (e) {
    test.strictSame(e instanceof Error, true);
  }
});
