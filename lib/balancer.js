'use strict';
class Balancer {
  constructor(pool) {
    this.metrics = new WeakMap();
    this.pool = pool;
  }

  monitoring() {
    for (const [worker] of this.pool) {
      const metrics = this.getMetrics(worker);
      const current = worker.performance.eventLoopUtilization();
      const delta = worker.performance.eventLoopUtilization(
        current,
        metrics.elu,
      );
      metrics.elu = current;
      const priority = 1 / Math.abs(delta.utilization);
      this.pool.setPriority(worker, priority);
    }
  }

  getMetrics(worker) {
    return (
      this.metrics.get(worker) ||
      (this.metrics.set(worker, {
        elu: worker.performance.eventLoopUtilization(),
      }),
      this.getMetrics(worker))
    );
  }
}

module.exports = { Balancer };
