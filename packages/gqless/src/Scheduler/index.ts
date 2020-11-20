import debounce from 'lodash/debounce';

import { InterceptorManager } from '../Interceptor';

const createLazyPromise = () => {
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

export const createScheduler = (
  interceptorManager: InterceptorManager,
  resolveAllSelections: () => Promise<void>
) => {
  const scheduler: {
    resolving: null | Promise<void>;
  } = {
    resolving: null,
  };

  const fetchSelections = debounce(
    () => {
      const resolvePromise = createLazyPromise();
      scheduler.resolving = resolvePromise.promise;
      resolveAllSelections()
        .then(resolvePromise.resolve, resolvePromise.reject)
        .finally(() => {
          scheduler.resolving = null;
        });
    },
    10,
    {
      maxWait: 1000,
    }
  );

  interceptorManager.globalInterceptor.addSelectionListeners.add(
    (_selection) => {
      fetchSelections();
    }
  );

  return scheduler;
};
