'use strict';

const { Worker } = require('worker_threads');
const path = require('path');
const { randomInt } = require('crypto');

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
const WIDENING = 20;

const OPTIONS_INT = ['pool', 'wait', 'timeout', 'monitoring'];

const balancer = {
  options: null,
  pool: [],
  modules: null,
  status: STATUS_NOT_INITIALIZED,
  timer: null,
  weightZones: [],
  max: 1,
  id: 1,
  tasks: new Map(),
  targets: null,
};

const rebalance = () => {
  let balance = 0;
  for (let i = 0; i < balancer.options.pool; i++) {
    const current = balancer.pool[i].performance.eventLoopUtilization();
    balance = balance + 1 - current.utilization;
    balancer.weightZones[i] = Math.floor(balance * WIDENING);
  }
  balancer.max = Math.floor(balance * WIDENING);
};

const balancedIndex = () =>
  balancer.weightZones.findIndex((b) => b >= randomInt(balancer.max));

const invoke = async (method, args) => {
  const id = balancer.id++;
  const current = balancer.pool[balancedIndex()];
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout execution for method '${method}'`));
    }, balancer.options.timeout);
    balancer.tasks.set(id, { resolve, reject, timer });
    current.postMessage({ id, method, args });
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
    throw new Error('Can not initialize noroutine more than once');
  }
  balancer.status = STATUS_INITIALIZATION;
  for (const module of options.modules) {
    if (typeof module !== 'object') {
      throw new Error('Module should export an interface');
    }
  }
  balancer.options = {
    modules: options.modules,
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
  balancer.targets = options.modules.map(findModule);
  for (const module of options.modules) {
    wrapModule(module);
  }
  const workerData = {
    modules: balancer.targets,
    timeout: balancer.options.timeout,
  };
  for (let i = 0; i < balancer.options.pool; i++) {
    register(new Worker(WORKER_PATH, { workerData }));
  }
  rebalance();
  balancer.timer = setInterval(rebalance, balancer.options.monitoring);
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
