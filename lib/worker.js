'use strict';

const { parentPort, workerData } = require('worker_threads');

const resolvedModules = workerData.modules.map((m) => require(m));
const target = Object.assign({}, ...resolvedModules);

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
