import { createClient } from '../src';

describe('creation', () => {
  test('create client', () => {
    createClient(
      {
        query: {},
        mutation: {},
        subscription: {},
      },
      {
        String: true,
      },
      async (_query, _variables) => {
        return {};
      }
    );
  });
});
