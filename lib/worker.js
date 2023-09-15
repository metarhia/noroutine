'use strict';

const { parentPort, workerData } = require('worker_threads');
const { WorkerMessageType, ParentMessageType } = require('./message-types');
const names = workerData.modules;
const target = names.reduce((o, name) => ({ ...o, ...require(name) }), {});

const worker = {
  tasks: [],
  handler: null,
};

const execute = (message) => {
  const method = target[message.method];
  const availabilityMessage = setImmediate(() => {
    parentPort.postMessage({
      type: WorkerMessageType.AVAILABILITY,
    });
  });
  const task = Promise.resolve(method(...message.args))
    .then((result) => {
      parentPort.postMessage({
        type: WorkerMessageType.RESULT,
        id: message.id,
        result,
      });
    })
    .catch((error) => {
      parentPort.postMessage({
        type: WorkerMessageType.RESULT,
        id: message.id,
        error,
      });
    })
    .finally(() => {
      clearImmediate(availabilityMessage);
    });
  worker.tasks.push(task);
};

const stop = (message) => {
  parentPort.off('message', worker.handler);
  Promise.allSettled(worker.tasks).then((data) =>
    parentPort.postMessage({
      id: message.id,
      type: WorkerMessageType.STOP,
      data,
    }),
  );
};

const messageHandler = (message) => {
  switch (message.type) {
    case ParentMessageType.EXECUTE:
      execute(message);
      break;
    case ParentMessageType.STOP:
      stop(message);
      break;
    default:
      throw new Error(`Unknown parent message type: ${message.type}`);
  }
};

const start = () => {
  worker.handler = messageHandler;
  parentPort.on('message', worker.handler);
};

start();
