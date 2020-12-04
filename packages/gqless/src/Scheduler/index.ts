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

  let pendingSelections: Set<Selection> | undefined;

  const fetchSelections = debounce((lazyPromise: LazyPromise) => {
    resolvingPromise = null;

    pendingSelections = new Set(globalInterceptor.fetchSelections);

    resolveSelections(pendingSelections).then(
      () => {
        scheduler.resolving = null;
        pendingSelections = new Set(globalInterceptor.fetchSelections);
        lazyPromise.resolve();
      },
      (err) => {
        scheduler.resolving = null;
        pendingSelections = new Set(globalInterceptor.fetchSelections);
        lazyPromise.reject(err);
      }
    );
  }, catchSelectionsTimeMS);

  globalInterceptor.selectionAddListeners.add((selection) => {
    if (pendingSelections?.has(selection)) return;

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
