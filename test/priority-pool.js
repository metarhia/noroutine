'use strict';

const metatests = require('metatests');
const { PriorityPool } = require('../lib/priority-pool');

metatests.test('PriorityPool: create from iterable', (test) => {
  const sut = PriorityPool.from(['A', 'B', 'C']);

  test.assert(sut);
  test.strictSame(sut.size, 3);
  test.strictSame(Array.from(sut), [
    ['A', 0],
    ['B', 0],
    ['C', 0],
  ]);
  test.end();
});

metatests.test('PriorityPool: add item', (test) => {
  const sut = PriorityPool.from(['A', 'B', 'C']);

  sut.add('D', 1);

  test.strictSame(sut.size, 4);
  test.strictSame(Array.from(sut), [
    ['A', 0],
    ['B', 0],
    ['C', 0],
    ['D', 1],
  ]);
  test.end();
});

metatests.test('PriorityPool: delete item', (test) => {
  const sut = PriorityPool.from(['A', 'B', 'C']);

  sut.delete('A');

  test.strictSame(sut.size, 2);
  test.strictSame(Array.from(sut), [
    ['B', 0],
    ['C', 0],
  ]);
  test.end();
});

metatests.test('PriorityPool: set priority', (test) => {
  const sut = PriorityPool.from(['A', 'B', 'C']);

  const existedItem = sut.setPriority('B', 1);
  const notExistedItem = sut.setPriority('D', 1);

  test.strictSame(existedItem, true);
  test.strictSame(notExistedItem, false);
  test.strictSame(sut.size, 3);
  test.strictSame(Array.from(sut), [
    ['A', 0],
    ['B', 1],
    ['C', 0],
  ]);
  test.end();
});

metatests.test('PriorityPool: capture', async (test) => {
  const sut = PriorityPool.from(['A', 'B', 'C']);
  sut.setPriority('B', 1);

  const obj1 = await sut.capture();
  const obj2 = await sut.capture();
  const obj3 = await sut.capture();

  test.strictSame(obj1, 'B');
  test.strictSame(obj2, 'A');
  test.strictSame(obj3, 'C');
  test.end();
});

metatests.test('PriorityPool: capture wait', async (test) => {
  const sut = PriorityPool.from(['A', 'B']);

  const obj1 = await sut.capture();
  const obj2 = await sut.capture();
  const promise = sut.capture().then((obj3) => {
    test.strictSame(obj3, obj2);
  });
  sut.release(obj2);
  await promise;
  test.strictSame(obj1, 'A');
  test.strictSame(obj2, 'B');
  test.end();
});

metatests.test('PriorityPool: set capacity', async (test) => {
  const sut = PriorityPool.from(['A', 'B', 'C']);

  const obj1 = await sut.capture();
  const obj2 = await sut.capture();
  sut.setCapacity(1);
  const sizeWhenTwoCaptured = sut.size;
  sut.release(obj1);
  const addResult = sut.add('D');

  test.strictSame(addResult, false);
  test.strictSame(sizeWhenTwoCaptured, 2);
  test.strictSame(sut.size, 1);
  test.strictSame(obj1, 'A');
  test.strictSame(obj2, 'B');
  test.strictSame(Array.from(sut), [['B', 0]]);
  test.end();
});

metatests.test('PriorityPool: factory', async (test) => {
  const elements = new Array(10).fill(0).map((_, idx) => idx);
  let idx = 0;
  const sut = new PriorityPool({
    capacity: 10,
    factory: () => elements[idx++],
  });

  const initialPoolSize = sut.size;
  for (let i = 0; i < 5; i++) {
    await sut.capture();
  }
  const poolSizeAfterFiveCaptured = sut.size;
  for (let i = 0; i < 5; i++) {
    await sut.capture();
  }
  const poolElements = Array.from(sut).map(([el]) => el);

  test.strictSame(initialPoolSize, 0);
  test.strictSame(poolSizeAfterFiveCaptured, 5);
  test.strictSame(sut.size, 10);
  test.strictSame(poolElements, elements);
  test.end();
});

metatests.test('PriorityPool: destructor', async (test) => {
  const elements = new Array(10).fill(0).map((_, idx) => idx);
  let idx = 0;
  const destructorCalls = [];
  const sut = new PriorityPool({
    capacity: 10,
    factory: () => elements[idx++],
    destructor: (el) => (destructorCalls.push(el), el),
  });

  for (let i = 0; i < 10; i++) {
    await sut.capture();
  }
  sut.setCapacity(5);
  for (let i = 0; i < 5; i++) {
    await sut.release(i);
  }
  const destructorCallsAfterChangingCapacity = [...destructorCalls];
  const flashResult = sut.flash();

  test.strictSame(destructorCallsAfterChangingCapacity, elements.slice(0, 5));
  test.strictSame(flashResult, elements.slice(5));
  test.strictSame(destructorCalls, elements);
  test.strictSame(sut.size, 0);
});
