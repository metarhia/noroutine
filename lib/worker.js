'use strict';

const { parentPort, workerData } = require('worker_threads');

const names = workerData.modules;
const target = names.reduce((o, name) => ({ ...o, ...require(name) }), {});

parentPort.on('message', ({ id, method, args }) => {
  const fn = target[method];
  fn(...args)
    .then((result) => {
      parentPort.postMessage({ id, result });
    })
    .catch((error) => {
      parentPort.postMessage({ id, error });
    });
});
