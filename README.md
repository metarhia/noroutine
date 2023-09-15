# Node Routine (noroutine)

[![ci status](https://github.com/metarhia/noroutine/workflows/Testing%20CI/badge.svg)](https://github.com/metarhia/noroutine/actions?query=workflow%3A%22Testing+CI%22+branch%3Amaster)
[![snyk](https://snyk.io/test/github/metarhia/noroutine/badge.svg)](https://snyk.io/test/github/metarhia/noroutine)
[![npm version](https://badge.fury.io/js/noroutine.svg)](https://badge.fury.io/js/noroutine)
[![npm downloads/month](https://img.shields.io/npm/dm/noroutine.svg)](https://www.npmjs.com/package/noroutine)
[![npm downloads](https://img.shields.io/npm/dt/noroutine.svg)](https://www.npmjs.com/package/noroutine)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/metarhia/noroutine/blob/master/LICENSE)

Goroutine analogue for Node.js, spreads I/O-bound routine (tasks) to utilize
thread pool with `worker_threads` using balancer with event loop utilization
(see `perf_hooks` API).

## Usage

Install: `npm install noroutine`

```js
const noroutine = require('noroutine');
const module1 = require('./module1.js');
const module2 = require('./module2.js');
noroutine.init({ modules: [module1, module2] });

(async () => {
  const res1 = await module1.method1('value1');
  const res2 = await module2.method2('value2');
  console.log({ res1, res2 });
})();
```

## Initialization options

```js
noroutine.init({
  modules: [module1, module2],
  pool: 5, // number of workers in thread pool
  wait: 2000, // maximum delay to wait for a free thread
  timeout: 5000, // maximum timeout for executing a functions
  monitoring: 5000, // balancer monitoring interval
  balancerFactory: customBalancerFactory, // balancer factory
});
```

### Balancer Factory

`balancerFactory` field is optional and serves as a factory for the balancer function. By default, the balancing strategy relies on event loop utilization. However, this default behavior can be extended or modified by specifying a custom balancer factory.

The balancer factory is executed once during the initialization process, and it takes the worker priority pool as a parameter.

The outcome of the balancer factory's execution is the balancer function itself. This function will be executed automatically at regular monitoring intervals, implementing the chosen balancing strategy as defined by the balancer factory.

Example (auto scaling balancer):

```js
noroutine.init({
  modules: [module1, module2],
  pool: 8,
  monitoring: 5000,
  balancerFactory: (pool) => {
    const defaultBalancer = noroutine.defaultBalancerFactory(pool);
    const minCapacity = 1;
    const maxCapacity = pool.getCapacity();
    return () => {
      const currentCapacity = pool.getCapacity();
      let minPriority = Infinity;
      let maxPriority = -Infinity;
      defaultBalancer();
      for (const [, priority] of pool) {
        minPriority = Math.min(minPriority, priority);
        maxPriority = Math.max(maxPriority, priority);
      }
      if (1 / minPriority > 0.9) {
        pool.setCapacity(Math.min(maxCapacity, currentCapacity + 1));
      } else if (1 / maxPriority < 0.1) {
        pool.setCapacity(Math.max(minCapacity, currentCapacity - 1));
      }
    };
  },
});
```

## License & Contributors

Copyright (c) 2021-2022 [Metarhia contributors](https://github.com/metarhia/noroutine/graphs/contributors).
Noroutine is [MIT licensed](./LICENSE).\
Noroutine is a part of [Metarhia](https://github.com/metarhia) technology stack.
