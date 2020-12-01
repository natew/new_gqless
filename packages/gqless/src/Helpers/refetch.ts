import { InnerClientState } from '../Client/client';
import { Selection } from '../Selection';

export function isFunction<T>(v: T | (() => T)): v is () => T {
  return typeof v === 'function';
}

export function createRefetch(
  innerState: InnerClientState,
  resolveSelections: (selections: Set<Selection>) => Promise<void>
) {
  const { interceptorManager, scheduler, accessorCache } = innerState;

  async function refetchFn<T>(fn: () => T) {
    const startSelectionsSize =
      interceptorManager.globalInterceptor.selections.size;

    let prevIgnoreCache = innerState.allowCache;

    try {
      innerState.allowCache = false;

      const data = fn();

      innerState.allowCache = prevIgnoreCache;

      if (
        interceptorManager.globalInterceptor.selections.size ===
        startSelectionsSize
      ) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('gqless: No selections made!');
        }
        return data;
      }

      await scheduler.resolving!.promise;

      prevIgnoreCache = innerState.allowCache;
      innerState.allowCache = true;

      return fn();
    } finally {
      innerState.allowCache = prevIgnoreCache;
    }
  }

  async function refetch<T = undefined | void>(refetchArg: T | (() => T)) {
    if (isFunction(refetchArg)) return refetchFn(refetchArg);

    if (accessorCache.isProxy(refetchArg)) {
      const selectionSet = accessorCache.getSelectionSetHistory(refetchArg);

      if (selectionSet) {
        await resolveSelections(selectionSet);
      }
      return refetchArg;
    }

    if (process.env.NODE_ENV !== 'production') {
      console.warn('gqless: Invalid proxy to refetch!');
    }
    return refetchArg;
  }

  return refetch;
}
