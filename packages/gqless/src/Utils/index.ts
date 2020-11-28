export interface LazyPromise<T = void> {
  promise: Promise<T>;
  resolve: T extends void ? () => void : (value: T) => void;
  reject: (reason: unknown) => void;
}

export function createLazyPromise<T = void>(): LazyPromise<T> {
  let resolve: T extends void
    ? () => void
    : (value: T) => void = undefined as any;
  let reject: (reason: unknown) => void = undefined as any;
  const promise = new Promise<T>((resolveFn: any, rejectFn) => {
    resolve = resolveFn;
    reject = rejectFn;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

export function isInteger(v: any): v is number {
  return Number.isInteger(v);
}
