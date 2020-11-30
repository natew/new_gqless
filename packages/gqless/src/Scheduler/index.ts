import debounce from 'lodash/debounce';

import { InterceptorManager } from '../Interceptor';
import { Selection } from '../Selection';
import { createLazyPromise, LazyPromise } from '../Utils';

export type Scheduler = ReturnType<typeof createScheduler>;

export const createScheduler = (
  interceptorManager: InterceptorManager,
  resolveAllSelections: () => Promise<void>
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

  const fetchSelections = debounce((lazyPromise: LazyPromise) => {
    resolvingPromise = null;

    resolveAllSelections().then(
      () => {
        scheduler.resolving = null;
        lazyPromise.resolve();
      },
      (err) => {
        scheduler.resolving = null;
        lazyPromise.reject(err);
      }
    );
  }, 10);

  interceptorManager.globalInterceptor.selectionAddListeners.add(
    (selection) => {
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
    }
  );

  return scheduler;
};
