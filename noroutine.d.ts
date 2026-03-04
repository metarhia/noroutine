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

export interface CapturedWorker {
  modules: object[];
  release: () => void;
}

export function capture(options?: CaptureOptions): Promise<CapturedWorker>;

export function withCapture<T = any>(
  options: CaptureOptions,
  task: (modules: object[]) => Promise<T>,
): Promise<T>;
