import { InnerClientState } from '../Client/client';

export function createRefetch(innerState: InnerClientState) {
  const { interceptorManager, scheduler } = innerState;
  async function refetch<T = undefined | void>(refetchFn: () => T) {
    const startSelectionsSize =
      interceptorManager.globalInterceptor.selections.size;

    let prevIgnoreCache = innerState.allowCache;

    try {
      innerState.allowCache = false;

      const data = refetchFn();

      innerState.allowCache = prevIgnoreCache;

      if (
        interceptorManager.globalInterceptor.selections.size ===
        startSelectionsSize
      ) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Warning: No selections made!');
        }
        return data;
      }

      await scheduler.resolving!.promise;

      prevIgnoreCache = innerState.allowCache;
      innerState.allowCache = true;

      return refetchFn();
    } finally {
      innerState.allowCache = prevIgnoreCache;
    }
  }

  return refetch;
}
