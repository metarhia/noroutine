'use strict';
class PriorityPool {
  constructor({ factory, destructor = (x) => x, capacity }) {
    this.capacity = capacity;
    this.factory = factory;
    this.destructor = destructor;
    this.available = new Set();
    this.pool = new Map();
    this.waitQueue = [];
  }

  static from(iterable) {
    const pool = new PriorityPool({
      capacity: Infinity,
    });
    for (const value of iterable) {
      pool.add(value, 0);
    }
    return pool;
  }

  get waitQueueSize() {
    return this.waitQueue.length;
  }

  get size() {
    return this.pool.size;
  }

  getCandidate() {
    let priority = -Infinity;
    let candidate = null;
    for (const item of this.available) {
      const itemPriority = this.pool.get(item);
      if (priority < itemPriority) {
        priority = itemPriority;
        candidate = item;
      }
    }
    return candidate;
  }

  async capture() {
    const item = this.getCandidate();
    if (item) return this.available.delete(item) && item;
    if (this.pool.size < this.capacity && this.factory) {
      return this.createItem();
    }
    return new Promise((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release(item) {
    if (!this.pool.has(item)) return false;
    if (this.capacity < this.pool.size) {
      this.delete(item);
      return true;
    }
    const resolve = this.waitQueue.shift();
    if (resolve) resolve(item);
    else this.available.add(item);
    return true;
  }

  setPriority(item, priority) {
    if (!this.pool.has(item)) return false;
    this.pool.set(item, priority);
    return true;
  }

  add(item, priority) {
    if (this.capacity === this.pool.size) return false;
    this.pool.set(item, priority);
    this.available.add(item);
    return true;
  }

  delete(item) {
    this.available.delete(item);
    if (this.pool.delete(item)) return this?.destructor(item);
    return void 0;
  }

  getCapacity() {
    return this.capacity;
  }

  async setCapacity(capacity) {
    for (let i = 0; i < this.pool.size - capacity; i++) {
      const item = this.getCandidate();
      this.delete(item);
    }
    this.capacity = capacity;
    return this;
  }

  flash() {
    const result = [];
    for (const [item] of this.pool) {
      this.available.delete(item);
      this.pool.delete(item);
      result.push(this?.destructor(item));
    }
    return result;
  }

  entries() {
    return this.pull.entries();
  }

  [Symbol.iterator]() {
    return this.pool.entries();
  }

  createItem() {
    const item = this.factory();
    this.pool.set(item, 0);
    return item;
  }
}
module.exports = { PriorityPool };
