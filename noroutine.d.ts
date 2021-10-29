export interface NoroutineOptions {
  module: object;
  pool?: number;
  wait?: number;
  timeout?: number;
  monitoring?: number;
}

export function init(options: NoroutineOptions): void;
export function finalize(): Promise<void>;
