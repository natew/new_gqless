import { GraphQLError, stripIgnoredCharacters } from 'graphql';

import { gqlessError, SelectionType } from '../src';
import { FetchEventData } from '../src/Events';
import { createTestClient } from './utils';

describe('fetch events', () => {
  test('successful query', async () => {
    const {
      eventHandler: loggerHandler,
      query,
      resolved,
      cache,
    } = await createTestClient();

    const onFetchData = jest
      .fn()
      .mockImplementation(async (dataPromise: Promise<FetchEventData>) => {
        const {
          executionResult,
          cacheSnapshot,
          query,
          selections,
          type,
          variables,
          error,
        } = await dataPromise;

        expect(cache).toStrictEqual(cacheSnapshot);

        expect(stripIgnoredCharacters(query)).toBe('query{hello}');

        expect(selections.length).toBe(1);
        expect(selections[0].key).toBe('hello');
        expect(selections[0].type).toBe(SelectionType.Query);
        expect(type).toBe('query');
        expect(variables).toBe(undefined);
        expect(error).toBe(undefined);

        expect(executionResult?.data?.hello).toBe('hello world');
      });

    const unsubscribe = loggerHandler.onFetchSubscribe(onFetchData);

    try {
      const dataPromise = resolved(() => {
        return query.hello;
      });
      expect(onFetchData).toBeCalledTimes(1);

      const data = await dataPromise;

      expect(data).toBe('hello world');
    } finally {
      unsubscribe();
    }
  });

  test('error query', async () => {
    const {
      eventHandler: loggerHandler,
      query,
      resolved,
    } = await createTestClient();

    const onFetchData = jest
      .fn()
      .mockImplementation(async (dataPromise: Promise<FetchEventData>) => {
        const { executionResult, error, query } = await dataPromise;

        expect(executionResult?.data).toBe(undefined);

        expect(error).toStrictEqual(
          new gqlessError('expected error', {
            graphQLErrors: [new GraphQLError('expected error')],
          })
        );

        expect(stripIgnoredCharacters(query)).toBe('query{throw}');
      });

    const unsubscribe = loggerHandler.onFetchSubscribe(onFetchData);

    try {
      const dataPromise = resolved(() => {
        return query.throw;
      });
      expect(onFetchData).toBeCalledTimes(1);

      const data = await dataPromise.catch(() => {});

      expect(data).toBe(undefined);
    } finally {
      unsubscribe();
    }
  });
});
