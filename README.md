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

noroutine.init({
  module: './module1.js',
  pool: 5,
  wait: 2000,
  timeout: 5000,
});

(async () => {
  const res = await norutine.method1({ key: 'value' });
  console.log({ res });
})();
```

## License & Contributors

Copyright (c) 2017-2021 [Metarhia contributors](https://github.com/metarhia/noroutine/graphs/contributors).
Noroutine is [MIT licensed](./LICENSE).\
Noroutine is a part of [Metarhia](https://github.com/metarhia) technology stack.
