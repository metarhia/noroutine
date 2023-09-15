export interface PriorityPoolConfig<T, D> {
  capacity: number;
  factory: () => T;
  destructor: (item: T) => D;
}

export interface PriorityPool<T, D> {
  waitQueueSize: number;
  size: number;

  [Symbol.iterator](): IterableIterator<[T, number]>;
  capture(): Promise<T>;
  release(item: T): boolean;
  setPriority(item: T, priority: number): boolean;
  add(item: T, priority: number): boolean;
  delete(item: T): D;
  getCapacity(): number;
  setCapacity(capacity: number): this;
  flash(): D[];
  entries(): IterableIterator<[T, number]>;
}
