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

export interface CaptureOptions {
  waitTimeout?: number;
  autoReleaseTimeout?: number;
  executionTimeout?: number;
}
export function capture(options?: CaptureOptions): {
  modules: object[];
  release: Function;
};
