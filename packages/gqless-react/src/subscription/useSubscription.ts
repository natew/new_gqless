import { createClient } from '@dish/gqless';
import {
  isAnySelectionIncluded,
  useForceUpdate,
  useIsomorphicLayoutEffect,
  useSelectionsState,
} from '../common';
import { ReactClientOptionsWithDefaults } from '../utils';

export function createUseSubscription<
  GeneratedSchema extends {
    subscription: object;
  }
>(
  client: ReturnType<typeof createClient>,
  _opts: ReactClientOptionsWithDefaults
) {
  const {
    interceptorManager: { createInterceptor, removeInterceptor },
    subscriptionsClient,
    eventHandler,
    scheduler,
  } = client;
  const clientSubscription: GeneratedSchema['subscription'] =
    client.subscription;

  const useSubscription = function useSubscription() {
    const forceUpdate = useForceUpdate();
    const hookSelections = useSelectionsState();

    const interceptor = createInterceptor();

    Promise.resolve(interceptor).then(removeInterceptor);

    interceptor.selectionAddListeners.add((selection) => {
      if (selection.type === 2) hookSelections.add(selection);
    });

    useIsomorphicLayoutEffect(() => {
      removeInterceptor(interceptor);
    });

    useIsomorphicLayoutEffect(() => {
      if (!subscriptionsClient) return;

      let isMounted = true;

      const unsubscribeCache = eventHandler.onCacheChangeSubscribe(
        ({ selection }) => {
          if (!isMounted || forceUpdate.wasCalled.current) return;

          if (hookSelections.has(selection)) forceUpdate();
        }
      );

      const unsubErrors = scheduler.errors.subscribeErrors((data) => {
        if (
          isMounted &&
          data.type === 'new_error' &&
          !forceUpdate.wasCalled.current &&
          isAnySelectionIncluded(data.selections, hookSelections)
        ) {
          forceUpdate();
        }
      });

      return () => {
        isMounted = false;
        unsubErrors();
        unsubscribeCache();
        subscriptionsClient.unsubscribe(hookSelections);
      };
    }, [hookSelections, forceUpdate]);

    return clientSubscription;
  };

  return useSubscription;
}
