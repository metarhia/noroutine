'use strict';

const { parentPort, workerData } = require('worker_threads');

const target = workerData.modules.reduce(
  (acc, module) => ({ ...acc, ...require(module) }),
  {}
);

parentPort.on('message', (message) => {
  const method = target[message.method];
  method(...message.args)
    .then((result) => {
      parentPort.postMessage({ id: message.id, result });
    })
    .catch((error) => {
      parentPort.postMessage({ id: message.id, error });
    });
});
