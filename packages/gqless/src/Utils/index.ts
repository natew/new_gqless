export interface LazyPromise<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

export function createLazyPromise<T>(): LazyPromise<T> {
  let resolve: (value: T) => void = undefined as any;
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
