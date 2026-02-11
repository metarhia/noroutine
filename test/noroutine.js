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

metatests.test('Capture worker and execute task', async (test) => {
  const {
    modules: [m1],
    release,
  } = await noroutine.capture();
  try {
    const res = await m1.method1('capture-test');
    test.strictSame(res, { key: 'capture-test' });
  } finally {
    release();
  }
  test.end();
});

metatests.test('Auto-release after timeout', async (test) => {
  const {
    modules: [m1],
  } = await noroutine.capture({
    autoReleaseTimeout: 500,
  });
  const res = await m1.method1('auto-release-test');
  test.strictSame(res, { key: 'auto-release-test' });
  await metautil.delay(600);
  test.end();
});

metatests.test('Execution timeout for captured worker', async (test) => {
  const {
    modules: [m1],
    release,
  } = await noroutine.capture({
    executionTimeout: 500,
    autoReleaseTimeout: Infinity,
  });
  try {
    await m1.method2('timeout-test');
    test.fail('Should throw execution timeout error');
  } catch (e) {
    test.assert(
      e.message.includes('Timeout') || e.message.includes('timeout'),
      'Should throw timeout error',
    );
  } finally {
    release();
  }
  test.end();
});

metatests.test('Error when using released worker', async (test) => {
  const {
    modules: [m1],
    release,
  } = await noroutine.capture();
  const res = await m1.method1('before-release');
  test.strictSame(res, { key: 'before-release' });
  release();
  try {
    await m1.method1('after-release');
    test.fail('Should throw error when using released worker');
  } catch (e) {
    test.assert(e.message.includes('released'));
  }
  test.end();
});
