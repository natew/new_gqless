import { gqlessError, Selection, SubscriptionsClient } from '@dish/gqless';

import { Client, ClientOptions } from './subscription/client';

export interface SubscriptionsClientOptions extends ClientOptions {
  wsEndpoint: string | (() => string | Promise<string>);
}

export function createSubscriptionClient({
  wsEndpoint,
  ...opts
}: SubscriptionsClientOptions): SubscriptionsClient {
  const urlPromise = Promise.resolve(
    typeof wsEndpoint === 'string' ? wsEndpoint : wsEndpoint()
  );

  let wsClientValue: Client | undefined;

  const wsClientPromise: Promise<Client> = new Promise((resolve, reject) => {
    urlPromise
      .then((url) => {
        const client = new Client(url, {
          ...opts,
        });
        wsClientValue = client;
        resolve(client);
      })
      .catch(reject);
  });

  const SubscriptionsSelections: Map<string, Set<Selection>> = new Map();

  return {
    async subscribe({
      query,
      variables,
      onData,
      onError,
      cacheKey,
      selections,
    }) {
      const wsClient = wsClientValue || (await wsClientPromise);

      const operationId = await wsClient.createSubscription(
        query,
        variables,
        ({ payload }) => {
          if (!payload) {
            SubscriptionsSelections.delete(operationId);
            return;
          }

          const { data, errors } = payload;
          if (data) onData(data);

          if (errors?.length) {
            onError({
              data,
              error: gqlessError.fromGraphQLErrors(errors),
            });
          }
        },
        cacheKey
      );

      SubscriptionsSelections.set(operationId, new Set(selections));

      const unsubscribe = async () => {
        await wsClient.unsubscribe(operationId, true);
      };

      return {
        unsubscribe,
      };
    },
    async unsubscribe(selections) {
      const wsClient = wsClientValue || (await wsClientPromise);

      let promises: Promise<void>[] = [];

      checkOperations: for (const [
        operationId,
        operationSelections,
      ] of SubscriptionsSelections.entries()) {
        for (const selection of selections) {
          if (operationSelections.has(selection)) {
            promises.push(wsClient.unsubscribe(operationId, true));
            continue checkOperations;
          }
        }
      }

      if (promises.length) await Promise.all(promises);
    },
  };
}
