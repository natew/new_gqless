import { GraphQLError } from 'graphql';
import { gqlessError, Poller } from '../src';
import { createLazyPromise } from '../src/Utils';
import { createTestClient } from './utils';

describe('poller', () => {
  test('works', async () => {
    const client = await createTestClient();
    const { query } = client;

    let n = -1;

    const poller = new Poller(
      () => {
        if (n < 3) {
          return query.nFetchCalls;
        }

        query.throw;

        return query.nFetchCalls;
      },
      50,
      client
    );

    let fetchPromise = createLazyPromise();
    let dataPromise = createLazyPromise();

    const unsubscribe = poller.subscribe((event) => {
      switch (event.type) {
        case 'fetching': {
          fetchPromise.resolve();
          fetchPromise = createLazyPromise();
          break;
        }
        case 'data': {
          n = event.data;
          dataPromise.resolve();
          dataPromise = createLazyPromise();
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

      expect(poller.data).toBe(n);

      try {
        await fetchPromise.promise;

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
});
