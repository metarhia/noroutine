'use strict';

const { Worker } = require('worker_threads');
const { PriorityPool } = require('./lib/priority-pool');
const { Balancer } = require('./lib/balancer');
const { WorkerMessageType, ParentMessageType } = require('./lib/message-types');
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
const DEFAULT_BALANCER_FACTORY = (pool) => {
  const balancer = new Balancer(pool);
  return balancer.monitoring.bind(balancer);
};

const OPTIONS_INT = ['pool', 'wait', 'timeout', 'monitoring'];

const planner = {
  options: null,
  pool: null,
  modules: null,
  status: STATUS_NOT_INITIALIZED,
  timer: null,
  id: 1,
  tasks: new Map(),
  targets: null,
};

const captureWorker = async () => {
  const workerPromise = planner.pool.capture();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      workerPromise.then((worker) => planner.pool.release(worker));
      reject(new Error('Tread wait timeout'));
    }, planner.options.wait);
    workerPromise.then((worker) => {
      clearTimeout(timeout);
      resolve(worker);
    });
  });
};

const stopWorker = (worker) => {
  const id = planner.id++;
  return new Promise((resolve) => {
    planner.tasks.set(id, { resolve });
    worker.postMessage({
      type: ParentMessageType.STOP,
      id,
    });
  });
};

const stopResult = ({ id, data }) => {
  const task = planner.tasks.get(id);
  planner.tasks.delete(id);
  task.resolve(data);
};

const invoke = async (method, args) => {
  const id = planner.id++;
  const current = await captureWorker();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout execution for method '${method}'`));
    }, planner.options.timeout);
    planner.tasks.set(id, { resolve, reject, timer });
    current.postMessage({ type: ParentMessageType.EXECUTE, id, method, args });
  });
};

const workerResults = ({ id, error, result }) => {
  const task = planner.tasks.get(id);
  clearTimeout(task.timer);
  planner.tasks.delete(id);
  if (error) task.reject(error);
  else task.resolve(result);
};

const handleMessage = (worker, message) => {
  switch (message.type) {
    case WorkerMessageType.AVAILABILITY:
      planner.pool.release(worker);
      break;
    case WorkerMessageType.RESULT:
      workerResults(message);
      planner.pool.release(worker);
      break;
    case WorkerMessageType.STOP:
      stopResult(message);
      break;
    default:
      throw new Error(`Unknown worker message type: ${message.type}`);
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

const initPull = (workerData) =>
  new PriorityPool({
    factory: () => {
      const worker = new Worker(WORKER_PATH, { workerData });
      worker.on('message', (message) => {
        handleMessage(worker, message);
      });
      return worker;
    },
    destructor: async (worker) => {
      if (planner.status !== STATUS_FINALIZATION) await stopWorker(worker);
      return worker.terminate();
    },
    capacity: planner.options.pool,
  });

const validateOptions = (options) => {
  for (const module of options.modules) {
    if (typeof module !== 'object') {
      throw new Error('Module should export an interface');
    }
  }
  const resultOptions = {
    modules: options.modules,
    pool: options.pool || DEFAULT_POOL_SIZE,
    wait: options.wait || DEFAULT_THREAD_WAIT,
    timeout: options.timeout || DEFAULT_TIMEOUT,
    monitoring: options.monitoring || DEFAULT_MON_INTERVAL,
    balancerFactory: options.balancerFactory || DEFAULT_BALANCER_FACTORY,
  };
  for (const key of OPTIONS_INT) {
    const value = resultOptions[key];
    if (!Number.isInteger(value)) {
      throw new Error(`Norutine.init: options.${key} should be integer`);
    }
  }
  return resultOptions;
};

const init = (options) => {
  if (planner.status !== STATUS_NOT_INITIALIZED) {
    throw new Error('Can not initialize noroutine more than once');
  }
  planner.status = STATUS_INITIALIZATION;
  planner.options = validateOptions(options);
  planner.targets = options.modules.map(findModule);
  for (const module of options.modules) {
    wrapModule(module);
  }
  const workerData = {
    modules: planner.targets,
    timeout: planner.options.timeout,
  };
  planner.pool = initPull(workerData);
  const workerBalancer = planner.options.balancerFactory(planner.pool);
  planner.timer = setInterval(workerBalancer, planner.options.monitoring);
  planner.status = STATUS_INITIALIZED;
};

const finalize = async () => {
  planner.status = STATUS_FINALIZATION;
  clearInterval(planner.timer);
  const finals = planner.pool.flash();
  await Promise.allSettled(finals);
  planner.status = STATUS_FINALIZED;
};

module.exports = {
  init,
  finalize,
  defaultBalancerFactory: DEFAULT_BALANCER_FACTORY,
};
