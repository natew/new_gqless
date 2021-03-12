import { GraphQLError } from 'graphql';
import { gqlessError, Poller } from '../src';
import { createDeferredPromise } from '../src/Utils';
import { createTestClient, TestClientConfig } from './utils';

describe('poller', () => {
  test('works', async () => {
    const config: TestClientConfig = {};
    const client = await createTestClient(undefined, undefined, config);
    const { query } = client;

    let n = -1;

    const poller = new Poller(
      () => {
        if (n < 4) {
          return query.nFetchCalls;
        }

        query.throw;

        return n;
      },
      50,
      client
    );

    let fetchPromise = createDeferredPromise();
    let dataPromise = createDeferredPromise();

    const unsubscribe = poller.subscribe((event) => {
      switch (event.type) {
        case 'fetching': {
          fetchPromise.resolve();
          fetchPromise = createDeferredPromise();
          break;
        }
        case 'data': {
          n = event.data;
          dataPromise.resolve();
          dataPromise = createDeferredPromise();
          break;
        }
        case 'error': {
          dataPromise.reject(event.error);
          break;
        }
      }
    });

    try {
      poller.pollInterval = 50;
      poller.pollInterval = 60;
      expect(poller.pollInterval).toBe(60);
      poller.start();

      poller.pollInterval = 50;
      expect(poller.pollInterval).toBe(50);

      expect(poller.isPolling).toBe(true);

      await fetchPromise.promise;

      expect(n).toBe(-1);

      await dataPromise.promise;

      expect(n).toBe(1);

      expect(poller.data).toBe(n);

      await fetchPromise.promise;

      expect(n).toBe(1);

      await dataPromise.promise;

      expect(n).toBe(2);

      expect(poller.data).toBe(n);

      poller.pollInterval = 10;

      expect(poller.pollInterval).toBe(10);

      await fetchPromise.promise;

      expect(n).toBe(2);

      await dataPromise.promise;

      expect(n).toBe(3);
      config.artificialDelay = 100;

      expect(poller.data).toBe(n);

      await fetchPromise.promise;

      await dataPromise.promise;

      expect(n).toBe(4);
      expect(poller.data).toBe(n);

      await fetchPromise.promise;

      try {
        await dataPromise.promise;

        throw Error("shouldn't reach here");
      } catch (err) {
        expect(err).toEqual(
          new gqlessError('expected error', {
            graphQLErrors: [new GraphQLError('expected error')],
          })
        );
      }

      poller.stop();

      expect(poller.isPolling).toBe(false);
    } finally {
      unsubscribe();
    }
  });

  test('with object poll function', async () => {
    const client = await createTestClient(undefined, undefined);
    const { query } = client;

    let n = -1;

    const poller = new Poller(
      {
        current: () => {
          return query.nFetchCalls;
        },
      },
      50,
      client
    );

    let fetchPromise = createDeferredPromise();
    let dataPromise = createDeferredPromise();

    const unsubscribe = poller.subscribe((event) => {
      switch (event.type) {
        case 'fetching': {
          fetchPromise.resolve();
          fetchPromise = createDeferredPromise();
          break;
        }
        case 'data': {
          n = event.data;
          dataPromise.resolve();
          dataPromise = createDeferredPromise();
          break;
        }
        case 'error': {
          dataPromise.reject(event.error);
          break;
        }
      }
    });

    try {
      poller.start();

      await fetchPromise.promise;

      expect(n).toBe(-1);

      await dataPromise.promise;

      expect(n).toBe(1);
    } finally {
      poller.stop();
      unsubscribe();
    }
  });
});
