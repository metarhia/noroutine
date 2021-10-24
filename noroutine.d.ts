export interface NoroutineOptimons {
  module: object;
  pool: number;
  wait: number;
  timeout: number;
}

export function init(options: NoroutineOptimons): void;
export function finalize(): void;
