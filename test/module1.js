'use strict';

const metautil = require('metautil');

const method1 = async (value) => {
  await metautil.delay(500);
  if (value) return { key: value };
  return null;
};

module.exports = { method1 };
