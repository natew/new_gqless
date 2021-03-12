import { createClient } from '@dish/gqless';
import {
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

      const unsubscribeCache = eventHandler.onCacheChangeSubscribe(
        ({ selection }) => {
          if (forceUpdate.wasCalled.current) return;

          if (hookSelections.has(selection)) forceUpdate();
        }
      );

      return () => {
        unsubscribeCache();
        subscriptionsClient.unsubscribe(hookSelections);
      };
    }, [hookSelections, forceUpdate]);

    return clientSubscription;
  };

  return useSubscription;
}
