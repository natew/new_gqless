export const createLazyPromise = () => {
  let resolve: () => void = undefined as any;
  let reject: (reason: unknown) => void = undefined as any;
  const promise = new Promise<void>((resolveFn, rejectFn) => {
    resolve = resolveFn;
    reject = rejectFn;
  });

  return {
    promise,
    resolve,
    reject,
  };
};

export type LazyPromise = ReturnType<typeof createLazyPromise>;

export function isInteger(v: any): v is number {
  return Number.isInteger(v);
}
