import { fetch } from 'cross-fetch';
import { print } from 'graphql';

import { AsyncExecutor } from '@graphql-tools/delegate';
import { introspectSchema, wrapSchema } from '@graphql-tools/wrap';

export const getRemoteSchema = async (
  /**
   * Endpoint of the remote GraphQL API, if not specified, it points to http://localhost:3000/graphql
   */
  endpoint: string,
  /**
   * Specify configuration like headers for the introspection
   */
  { headers = {} }: { headers?: Record<string, string> } = {}
) => {
  const executor: AsyncExecutor = async ({ document, variables }) => {
    const query = print(document);
    const fetchResult = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({ query, variables }),
    });
    return fetchResult.json();
  };

  const schema = wrapSchema({
    schema: await introspectSchema(executor, {
      endpoint,
    }),
    executor,
  });

  return schema;
};
