import { PriorityPool } from './types/priority-pool';

export type BalancerFactory = (pool: PriorityPool<Worker, number>) => Function;

export interface NoroutineOptions {
  modules: object[];
  pool?: number;
  wait?: number;
  timeout?: number;
  monitoring?: number;
  balancerFactory?: BalancerFactory;
}

export function init(options: NoroutineOptions): void;
export function finalize(): Promise<void>;
export const defaultBalancerFactory: BalancerFactory;
