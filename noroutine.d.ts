export interface NoroutineOptions {
  modules: object[];
  pool?: number;
  maxCaptured?: number;
  wait?: number;
  timeout?: number;
  monitoring?: number;
}

export function init(options: NoroutineOptions): void;
export function finalize(): Promise<void>;
export function capture(timeout: number): {
  modules: object[];
  release: Function;
};
