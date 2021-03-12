import { gqlessError, SubscriptionsClient } from '@dish/gqless';

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

  return {
    async subscribe(opts) {
      const { query, variables, onData, onError, cacheKey } = opts;
      const wsClient = wsClientValue || (await wsClientPromise);

      const operationId = await wsClient.createSubscription(
        query,
        variables,
        ({ payload }) => {
          if (!payload) return;

          if (payload.data) {
            onData(payload.data);
          }
          if (payload.errors?.length) {
            onError({
              data: payload.data,
              error: gqlessError.fromGraphQLErrors(payload.errors),
            });
          }
        },
        cacheKey
      );

      const unsubscribe = async () => {
        await wsClient.unsubscribe(operationId, true);
      };

      return {
        unsubscribe,
      };
    },
  };
}
