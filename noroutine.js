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
const DEFAULT_MAX_CAPTURED = 3;
const DEFAULT_THREAD_WAIT = 2000;
const DEFAULT_TIMEOUT = 5000;
const DEFAULT_MON_INTERVAL = 5000;

const OPTIONS_INT = ['pool', 'maxCaptured', 'wait', 'timeout', 'monitoring'];

const balancer = {
  options: null,
  pool: [],
  modules: null,
  status: STATUS_NOT_INITIALIZED,
  captured: [],
  timer: null,
  elu: [],
  current: null,
  id: 1,
  tasks: new Map(),
  targets: null,
};

const monitoring = () => {
  let utilization = 1;
  let index = -1;
  for (let i = 0; i < balancer.options.pool; i++) {
    const isCaptured = balancer.captured[i];
    if (isCaptured) continue;
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
  if (index !== -1) {
    balancer.current = balancer.pool[index];
  }
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
  if (error) {
    task.reject(error);
  } else {
    task.resolve(result);
  }
};

const register = (worker) => {
  balancer.pool.push(worker);
  const elu = worker.performance.eventLoopUtilization();
  balancer.elu.push(elu);
  balancer.captured.push(false);
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

const capture = (timeout) => {
  const allCapturedWorkers = balancer.captured.filter(Boolean);
  if (allCapturedWorkers.length >= balancer.options.maxCaptured) {
    throw new Error('Max captured workers reached');
  }
  let captured = null;
  let index = 0;
  let released = false;
  let timer = null;
  for (let i = 0; i < balancer.options.pool; i++) {
    const isCaptured = balancer.captured[i];
    if (isCaptured) continue;
    balancer.captured[i] = true;
    captured = balancer.pool[i];
    index = i;
    break;
  }
  if (!captured) throw new Error('No free workers');

  const capturedInvoke = (method, args) => {
    if (released) throw new Error('Captured Worker already released');
    const id = balancer.id++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Captured Worker Timeout execution'));
      }, balancer.options.timeout);
      balancer.tasks.set(id, { resolve, reject, timer });
      captured.postMessage({ id, method, args });
    });
  };

  const capturedModules = balancer.options.modules.map((originalModule) => {
    const moduleCopy = {};
    for (const key of Object.keys(originalModule)) {
      if (typeof originalModule[key] !== 'function') continue;
      moduleCopy[key] = async (...args) => capturedInvoke(key, args);
    }
    return moduleCopy;
  });

  const capturedResult = {
    modules: capturedModules,
    release: () => {
      if (released) return;
      if (timer) clearTimeout(timer);
      released = true;
      balancer.captured[index] = false;
    },
  };
  if (timeout !== Infinity) {
    timer = setTimeout(() => capturedResult.release(), timeout);
  }

  return capturedResult;
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
    maxCaptured: options.maxCaptured || DEFAULT_MAX_CAPTURED,
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
  if (balancer.options.maxCaptured >= balancer.options.pool) {
    throw new Error(
      'Norutine.init: options.maxCaptured should be less than pool size',
    );
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

module.exports = { init, finalize, capture };
