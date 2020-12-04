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
  const resolveListeners = new Set<
    (promise: Promise<void>, selection: Selection) => void
  >();

  function subscribeResolve(
    fn: (promise: Promise<void>, selection: Selection) => void
  ) {
    resolveListeners.add(fn);

    return function unsubscribe() {
      resolveListeners.delete(fn);
    };
  }

  const scheduler = {
    resolving: null as null | LazyPromise,
    subscribeResolve,
  };

  let resolvingPromise: LazyPromise | null = null;

  const pendingSelectionsGroups = new Set<Set<Selection>>();

  const fetchSelections = debounce((lazyPromise: LazyPromise) => {
    resolvingPromise = null;

    const selectionsToFetch = new Set(globalInterceptor.fetchSelections);

    pendingSelectionsGroups.add(selectionsToFetch);

    resolveSelections(selectionsToFetch).then(
      () => {
        pendingSelectionsGroups.delete(selectionsToFetch);
        scheduler.resolving = null;
        lazyPromise.resolve();
      },
      (err) => {
        pendingSelectionsGroups.delete(selectionsToFetch);
        scheduler.resolving = null;
        lazyPromise.reject(err);
      }
    );
  }, catchSelectionsTimeMS);

  globalInterceptor.selectionAddListeners.add((selection) => {
    for (const group of pendingSelectionsGroups) {
      if (group.has(selection)) return;
    }

    let lazyPromise: LazyPromise;
    if (resolvingPromise === null) {
      lazyPromise = createLazyPromise();
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
