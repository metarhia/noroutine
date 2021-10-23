export interface NoroutineOptimons {
  module: string;
  pool: number;
  wait: number;
  timeout: number;
}

export function init(options: NoroutineOptimons): void;
