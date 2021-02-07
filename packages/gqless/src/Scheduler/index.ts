import debounce from 'lodash/debounce';
import { gqlessError } from '../Error';

import { InterceptorManager } from '../Interceptor';
import { Selection } from '../Selection';
import { createLazyPromise, LazyPromise } from '../Utils';

export type Scheduler = ReturnType<typeof createScheduler>;

export type SchedulerPromiseValue = { error: unknown } | null;

export const createScheduler = (
  { globalInterceptor }: InterceptorManager,
  resolveSelections: (selections: Set<Selection>) => Promise<void>,
  catchSelectionsTimeMS: number
) => {
  type ResolvingLazyPromise = LazyPromise<SchedulerPromiseValue>;
  type ResolvedLazyPromise = Promise<SchedulerPromiseValue>;

  type ResolveSubscriptionFn = (
    promise: ResolvedLazyPromise,
    selection: Selection
  ) => void;

  const resolveListeners = new Set<ResolveSubscriptionFn>();

  function subscribeResolve(fn: ResolveSubscriptionFn) {
    resolveListeners.add(fn);

    return function unsubscribe() {
      resolveListeners.delete(fn);
    };
  }

  const scheduler = {
    resolving: null as null | ResolvingLazyPromise,
    subscribeResolve,
    errors: {
      map: new Map<Selection, gqlessError>(),
      subscribeErrors,
      triggerError,
    },
  };

  type ErrorSubscriptionFn = (data: {
    error: gqlessError;
    selections: Selection[];
  }) => void;

  const errorsListeners = new Set<ErrorSubscriptionFn>();

  function subscribeErrors(fn: ErrorSubscriptionFn) {
    errorsListeners.add(fn);

    return function unsubscribe() {
      errorsListeners.delete(fn);
    };
  }

  function triggerError(error: gqlessError, selections: Selection[]) {
    const errorsMap = scheduler.errors.map;
    for (const selection of selections) errorsMap.set(selection, error);

    const data = {
      error,
      selections,
    };
    errorsListeners.forEach((listener) => {
      listener(data);
    });
  }

  let resolvingPromise: ResolvingLazyPromise | null = null;

  const pendingSelectionsGroups = new Set<Set<Selection>>();

  const fetchSelections = debounce((lazyPromise: ResolvingLazyPromise) => {
    resolvingPromise = null;

    const selectionsToFetch = new Set(globalInterceptor.fetchSelections);

    pendingSelectionsGroups.add(selectionsToFetch);

    resolveSelections(selectionsToFetch).then(
      () => {
        pendingSelectionsGroups.delete(selectionsToFetch);
        if (scheduler.resolving === lazyPromise) scheduler.resolving = null;
        lazyPromise.resolve(null);
      },
      (error) => {
        pendingSelectionsGroups.delete(selectionsToFetch);
        if (scheduler.resolving === lazyPromise) scheduler.resolving = null;
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

      lazyPromise.promise.then((result) => {
        if (result) console.error(result.error);
      });

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
