import debounce from 'lodash/debounce';
import { gqlessError } from '../Error';

import { InterceptorManager } from '../Interceptor';
import { Selection } from '../Selection';
import { createLazyPromise, LazyPromise } from '../Utils';

export type Scheduler = ReturnType<typeof createScheduler>;

export type SchedulerPromiseValue = {
  error?: unknown;
  selections: Set<Selection>;
};

export type ErrorSubscriptionFn = (
  data:
    | {
        newError: gqlessError;
        selections: Selection[];
      }
    | {
        selectionsCleaned: Selection[];
      }
    | {
        retryPromise: Promise<{
          error?: gqlessError;
          data?: unknown;
        }>;
        selections: Set<Selection>;
      }
) => void;

export type IsFetchingSubscriptionFn = (isFetching: boolean) => void;

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

  const errorsMap = new Map<Selection, gqlessError>();

  const pendingSelectionsGroups = new Set<Set<Selection>>();
  const pendingSelectionsGroupsPromises = new Map<
    Set<Selection>,
    ResolvedLazyPromise
  >();

  const scheduler = {
    resolving: null as null | ResolvingLazyPromise,
    subscribeResolve,
    errors: {
      map: errorsMap,
      subscribeErrors,
      triggerError,
      removeErrors,
      retryPromise,
    },
    isFetching: false,
    pendingSelectionsGroups,
    pendingSelectionsGroupsPromises,
  };

  const errorsListeners = new Set<ErrorSubscriptionFn>();

  function subscribeErrors(fn: ErrorSubscriptionFn) {
    errorsListeners.add(fn);

    return function unsubscribe() {
      errorsListeners.delete(fn);
    };
  }

  function retryPromise(
    retryPromise: Promise<{ error?: gqlessError; data?: unknown }>,
    selections: Set<Selection>
  ) {
    const data = {
      retryPromise,
      selections,
    };
    errorsListeners.forEach((listener) => {
      listener(data);
    });
  }

  function triggerError(newError: gqlessError, selections: Selection[]) {
    if (!selections.length) return;

    for (const selection of selections) errorsMap.set(selection, newError);

    const data = {
      newError,
      selections,
    };
    errorsListeners.forEach((listener) => {
      listener(data);
    });
  }

  function removeErrors(selectionsCleaned: Selection[]) {
    if (errorsMap.size === 0) return;

    for (const selection of selectionsCleaned) errorsMap.delete(selection);

    const data = {
      selectionsCleaned,
    };
    errorsListeners.forEach((listener) => {
      listener(data);
    });
  }

  let resolvingPromise: ResolvingLazyPromise | null = null;

  const fetchSelections = debounce((lazyPromise: ResolvingLazyPromise) => {
    resolvingPromise = null;

    const selectionsToFetch = new Set(globalInterceptor.fetchSelections);

    pendingSelectionsGroups.add(selectionsToFetch);
    pendingSelectionsGroupsPromises.set(selectionsToFetch, lazyPromise.promise);

    resolveSelections(selectionsToFetch).then(
      () => {
        pendingSelectionsGroups.delete(selectionsToFetch);
        pendingSelectionsGroupsPromises.delete(selectionsToFetch);
        if (scheduler.resolving === lazyPromise) scheduler.resolving = null;
        lazyPromise.resolve({
          selections: selectionsToFetch,
        });
      },
      (error) => {
        pendingSelectionsGroups.delete(selectionsToFetch);
        pendingSelectionsGroupsPromises.delete(selectionsToFetch);

        /* istanbul ignore else */
        if (scheduler.resolving === lazyPromise) scheduler.resolving = null;

        lazyPromise.resolve({
          error,
          selections: selectionsToFetch,
        });
      }
    );
  }, catchSelectionsTimeMS);

  globalInterceptor.selectionAddListeners.add((selection) => {
    for (const group of pendingSelectionsGroups) {
      if (group.has(selection)) {
        const promise = pendingSelectionsGroupsPromises.get(group);
        /* istanbul ignore next */
        if (promise) {
          resolveListeners.forEach((subscription) => {
            subscription(promise, selection);
          });
        }
        return;
      }
    }

    let lazyPromise: ResolvingLazyPromise;
    if (resolvingPromise === null) {
      lazyPromise = createLazyPromise();

      lazyPromise.promise.then(({ error }) => {
        if (error) console.error(error);
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
