'use strict';

const method1 = async (value) => {
  if (value) return { key: value };
  return null;
};

module.exports = { method1 };
