# Node Routine (noroutine)

[![ci status](https://github.com/metarhia/noroutine/workflows/Testing%20CI/badge.svg)](https://github.com/metarhia/noroutine/actions?query=workflow%3A%22Testing+CI%22+branch%3Amaster)
[![snyk](https://snyk.io/test/github/metarhia/noroutine/badge.svg)](https://snyk.io/test/github/metarhia/noroutine)
[![npm version](https://badge.fury.io/js/noroutine.svg)](https://badge.fury.io/js/noroutine)
[![npm downloads/month](https://img.shields.io/npm/dm/noroutine.svg)](https://www.npmjs.com/package/noroutine)
[![npm downloads](https://img.shields.io/npm/dt/noroutine.svg)](https://www.npmjs.com/package/noroutine)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/metarhia/noroutine/blob/master/LICENSE)

## Usage

Install: `npm install noroutine`

```js
const noroutine = require('noroutine');

const module1 = require('./module1.js');

noroutine.init({
  module: module1,
  pool: 5, // number of workers in thread pool
  wait: 2000, // maximim delay to wait for a free thread
  timeout: 5000, // maximum timeout for executing a functions
  monitoring: 5000, // event loop utilization monitoring interval
});

(async () => {
  const res = await module1.method1('value');
  console.log({ res });
})();
```

## License & Contributors

Copyright (c) 2021 [Metarhia contributors](https://github.com/metarhia/noroutine/graphs/contributors).
Noroutine is [MIT licensed](./LICENSE).\
Noroutine is a part of [Metarhia](https://github.com/metarhia) technology stack.
