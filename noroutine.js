'use strict';

const { Worker } = require('worker_threads');
const path = require('path');

const STATUS_NOT_INITIALIZED = 0;
const STATUS_INITIALIZATION = 1;
const STATUS_INITIALIZED = 2;
const STATUS_FINALIZATION = 3;
const STATUS_FINALIZED = 4;

const WORKER_PATH = path.join(__dirname, 'lib/worker.js');

const DEFAULT_POOL_SIZE = 5;
const DEFAULT_THREAD_WAIT = 2000;
const DEFAULT_TIMEOUT = 5000;
const DEFAULT_MON_INTERVAL = 5000;

const OPTIONS_INT = ['pool', 'wait', 'timeout', 'monitoring'];

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
  target: null,
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
    const timer = setTimeout(() => {
      reject(new Error(`Timeout execution for method '${method}'`));
    }, balancer.options.timeout);
    balancer.tasks.set(id, { resolve, reject, timer });
    balancer.current.postMessage({ id, method, args });
  });
};

const workerResults = ({ id, error, result }) => {
  const task = balancer.tasks.get(id);
  clearTimeout(task.timer);
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
  balancer.options = {
    module: options.module,
    pool: options.pool || DEFAULT_POOL_SIZE,
    wait: options.wait || DEFAULT_THREAD_WAIT,
    timeout: options.timeout || DEFAULT_TIMEOUT,
    monitoring: options.monitoring || DEFAULT_MON_INTERVAL,
  };
  for (const key of OPTIONS_INT) {
    const value = balancer.options[key];
    if (!Number.isInteger(value)) {
      throw new Error(`Norutine.init: options.${key} should be integer`);
    }
  }
  if (typeof options.module !== 'object') {
    throw new Error('Module should export an interface');
  }
  balancer.target = findModule(options.module);
  wrapModule(options.module);
  const workerData = {
    module: balancer.target,
    timeout: balancer.options.timeout,
  };
  for (let i = 0; i < balancer.options.pool; i++) {
    register(new Worker(WORKER_PATH, { workerData }));
  }
  balancer.current = balancer.pool[0];
  balancer.timer = setInterval(monitoring, balancer.options.monitoring);
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
