import debounce from 'lodash/debounce';

import { InterceptorManager } from '../Interceptor';
import { createLazyPromise, LazyPromise } from '../Utils';

export const createScheduler = (
  interceptorManager: InterceptorManager,
  resolveAllSelections: () => Promise<void>
) => {
  const resolveListeners = new Set<(promise: Promise<void>) => void>();

  function subscribeResolve(fn: (promise: Promise<void>) => void) {
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
    (_selection) => {
      let lazyPromise: LazyPromise;
      if (resolvingPromise === null) {
        lazyPromise = createLazyPromise();
        resolvingPromise = lazyPromise;
        scheduler.resolving = lazyPromise;
        resolveListeners.forEach((subscription) => {
          subscription(lazyPromise.promise);
        });
      } else {
        lazyPromise = resolvingPromise;
      }
      fetchSelections(lazyPromise);
    }
  );

  return scheduler;
};
