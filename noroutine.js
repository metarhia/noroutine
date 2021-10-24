'use strict';

const { Worker } = require('worker_threads');

const STATUS_NOT_INITIALIZED = 0;
const STATUS_INITIALIZATION = 1;
const STATUS_INITIALIZED = 2;
const STATUS_FINALIZATION = 3;
const STATUS_FINALIZED = 4;

const balancer = {
  options: null,
  pool: [],
  module: null,
  status: STATUS_NOT_INITIALIZED,
  timer: null,
  elu: [],
  current: null,
  id: 1,
  tasks: new Map(),
};

const monitoring = () => {
  let utilization = 1;
  let index = 0;
  for (let i = 0; i < balancer.options.pool; i++) {
    const worker = balancer.pool[i];
    const prev = balancer.elu[i];
    const current = worker.performance.eventLoopUtilization();
    const delta = worker.performance.eventLoopUtilization(current, prev);
    if (delta.utilization < utilization) {
      index = i;
      utilization = delta.utilization;
    }
    balancer.elu[i] = current;
  }
  balancer.current = balancer.pool[index];
};

const invoke = async (method, args) => {
  const id = balancer.id++;
  return new Promise((resolve, reject) => {
    balancer.tasks.set(id, { resolve, reject });
    balancer.current.postMessage({ id, method, args });
  });
};

const workerResults = ({ id, error, result }) => {
  const task = balancer.tasks.get(id);
  balancer.tasks.delete(id);
  if (error) task.reject(error);
  else task.resolve(result);
};

const register = (worker) => {
  balancer.pool.push(worker);
  const elu = worker.performance.eventLoopUtilization();
  balancer.elu.push(elu);
  worker.on('message', workerResults);
};

const findModule = (module) => {
  for (const file of Object.keys(require.cache)) {
    const cached = require.cache[file];
    if (cached.exports === module) return file;
  }
  throw new Error('Unknown module');
};

const wrapModule = (module) => {
  for (const key of Object.keys(module)) {
    if (typeof module[key] !== 'function') continue;
    module[key] = async (...args) => invoke(key, args);
  }
};

const init = (options) => {
  if (balancer.status !== STATUS_NOT_INITIALIZED) {
    throw new Error('Con not initialize noroutine more than once');
  }
  balancer.status = STATUS_INITIALIZATION;
  if (!Number.isInteger(options.pool) || options.pool <= 0) {
    throw new Error('Pool size should be integer greater than 0');
  }
  if (!Number.isInteger(options.wait)) {
    throw new Error('Pool wait should be integer');
  }
  if (!Number.isInteger(options.timeout)) {
    throw new Error('Executions timeout should be integer');
  }
  if (!Number.isInteger(options.monitoring) || options.monitoring < 1000) {
    throw new Error('Monitoring interval should be integer not less than 1000');
  }
  if (typeof options.module !== 'object') {
    throw new Error('Module should export an interface');
  }
  balancer.target = findModule(options.module);
  wrapModule(options.module);
  balancer.options = options;
  const workerData = { module: balancer.target, timeout: options.timeout };
  for (let i = 0; i < options.pool; i++) {
    register(new Worker('./lib/worker.js', { workerData }));
  }
  balancer.current = balancer.pool[0];
  balancer.timer = setInterval(monitoring, options.monitoring);
  balancer.status = STATUS_INITIALIZED;
};

const finalize = async () => {
  balancer.status = STATUS_FINALIZATION;
  clearInterval(balancer.timer);
  const finals = [];
  for (let i = 0; i < balancer.options.pool; i++) {
    const worker = balancer.pool[i];
    finals.push(worker.terminate());
  }
  await Promise.allSettled(finals);
  balancer.status = STATUS_FINALIZED;
};

module.exports = { init, finalize };
