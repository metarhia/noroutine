'use strict';

const { Worker } = require('worker_threads');
const path = require('path');
const { Pool } = require('metautil');

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
  pool: new Pool(),
  elu: new Map(),
  modules: null,
  status: STATUS_NOT_INITIALIZED,
  timer: null,
  current: null,
  id: 1,
  tasks: new Map(),
  targets: null,
};

const monitoring = () => {
  let utilization = 1;
  let index = -1;
  for (let i = 0; i < balancer.options.pool; i++) {
    const worker = balancer.pool.items[i];
    const isFree = balancer.pool.free[i];
    if (!isFree) continue;
    const prev = balancer.elu.get(worker);
    const current = worker.performance.eventLoopUtilization();
    const delta = worker.performance.eventLoopUtilization(current, prev);
    if (delta.utilization < utilization) {
      index = i;
      utilization = delta.utilization;
    }
    balancer.elu.set(worker, current);
  }
  if (index !== -1) {
    balancer.current = balancer.pool.items[index];
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

const capture = async (options = {}) => {
  const {
    waitTimeout = 30_000,
    autoReleaseTimeout = 30_000,
    executionTimeout = balancer.options.timeout,
  } = options;
  let isReleased = false;
  let autoReleaseTimer = null;

  const worker = await Promise.race([
    balancer.pool.capture(),
    new Promise((_, rej) => {
      setTimeout(() => rej(new Error('Worker timeout reached')), waitTimeout);
    }),
  ]);

  const capturedInvoke = (method, args) => {
    if (isReleased) throw new Error('Worker already released');
    const id = balancer.id++;
    return new Promise((resolve, reject) => {
      const taskTimer = setTimeout(() => {
        reject(new Error('Captured Worker Timeout execution'));
      }, executionTimeout);
      balancer.tasks.set(id, { resolve, reject, timer: taskTimer });
      worker.postMessage({ id, method, args });
    });
  };

  const capturedModules = balancer.options.modules.map((originalModule) => {
    const moduleProxy = {};
    for (const key of Object.keys(originalModule)) {
      if (typeof originalModule[key] !== 'function') continue;
      moduleProxy[key] = async (...args) => capturedInvoke(key, args);
    }
    return moduleProxy;
  });

  const release = () => {
    if (isReleased) return;
    if (autoReleaseTimer) clearTimeout(autoReleaseTimer);
    isReleased = true;
    balancer.pool.release(worker);
  };

  const capturedResult = {
    modules: capturedModules,
    release,
  };

  if (autoReleaseTimeout !== Infinity) {
    autoReleaseTimer = setTimeout(() => release(), autoReleaseTimeout);
  }

  return capturedResult;
};

const register = (worker) => {
  balancer.pool.add(worker);
  const elu = worker.performance.eventLoopUtilization();
  balancer.elu.set(worker, elu);
  worker.on('message', workerResults);
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
  balancer.pool.timeout = balancer.options.wait;
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
    const worker = new Worker(WORKER_PATH, { workerData });
    register(worker);
  }
  balancer.current = balancer.pool.items[0];
  balancer.timer = setInterval(monitoring, balancer.options.monitoring);
  balancer.status = STATUS_INITIALIZED;
};

const finalize = async () => {
  balancer.status = STATUS_FINALIZATION;
  clearInterval(balancer.timer);
  const finals = [];
  for (let i = 0; i < balancer.options.pool; i++) {
    const worker = balancer.pool.items[i];
    finals.push(worker.terminate());
  }
  await Promise.allSettled(finals);
  balancer.status = STATUS_FINALIZED;
};

module.exports = { init, finalize, capture };
