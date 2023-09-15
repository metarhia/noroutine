'use strict';

const WorkerMessageType = {
  RESULT: 'result',
  AVAILABILITY: 'raincheck',
  STOP: 'stopped',
};

const ParentMessageType = {
  EXECUTE: 'call',
  STOP: 'stop',
};

module.exports = {
  WorkerMessageType,
  ParentMessageType,
};
