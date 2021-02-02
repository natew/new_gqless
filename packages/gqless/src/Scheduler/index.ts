import debounce from 'lodash/debounce';

import { InterceptorManager } from '../Interceptor';
import { Selection } from '../Selection';
import { createLazyPromise, LazyPromise } from '../Utils';

export type Scheduler = ReturnType<typeof createScheduler>;

export const createScheduler = (
  { globalInterceptor }: InterceptorManager,
  resolveSelections: (selections: Set<Selection>) => Promise<void>,
  catchSelectionsTimeMS: number
) => {
  type ResolvingLazyPromise = LazyPromise<{ error: unknown } | null>;
  type ResolvedLazyPromise = Promise<{ error: unknown } | null>;

  const resolveListeners = new Set<
    (promise: ResolvedLazyPromise, selection: Selection) => void
  >();

  function subscribeResolve(
    fn: (promise: ResolvedLazyPromise, selection: Selection) => void
  ) {
    resolveListeners.add(fn);

    return function unsubscribe() {
      resolveListeners.delete(fn);
    };
  }

  const scheduler = {
    resolving: null as null | ResolvingLazyPromise,
    subscribeResolve,
  };

  let resolvingPromise: ResolvingLazyPromise | null = null;

  const pendingSelectionsGroups = new Set<Set<Selection>>();

  const fetchSelections = debounce((lazyPromise: ResolvingLazyPromise) => {
    resolvingPromise = null;

    const selectionsToFetch = new Set(globalInterceptor.fetchSelections);

    pendingSelectionsGroups.add(selectionsToFetch);

    resolveSelections(selectionsToFetch).then(
      () => {
        pendingSelectionsGroups.delete(selectionsToFetch);
        scheduler.resolving = null;
        lazyPromise.resolve(null);
      },
      (error) => {
        pendingSelectionsGroups.delete(selectionsToFetch);
        scheduler.resolving = null;
        lazyPromise.resolve({
          error,
        });
      }
    );
  }, catchSelectionsTimeMS);

  globalInterceptor.selectionAddListeners.add((selection) => {
    for (const group of pendingSelectionsGroups) {
      if (group.has(selection)) return;
    }

    let lazyPromise: ResolvingLazyPromise;
    if (resolvingPromise === null) {
      lazyPromise = createLazyPromise();

      lazyPromise.promise.then(
        (result) => result && console.error(result.error)
      );

      resolvingPromise = lazyPromise;
      scheduler.resolving = lazyPromise;
    } else {
      lazyPromise = resolvingPromise;
    }
    const promise = lazyPromise.promise;
    resolveListeners.forEach((subscription) => {
      subscription(promise, selection);
    });
    fetchSelections(lazyPromise);
  });

  return scheduler;
};
