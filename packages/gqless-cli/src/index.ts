import { fetch } from 'cross-fetch';
import { print } from 'graphql';

import { AsyncExecutor } from '@graphql-tools/delegate';
import { introspectSchema, wrapSchema } from '@graphql-tools/wrap';

const HTTP_GRAPHQL_ENDPOINT = 'http://localhost:3000/graphql';

const executor: AsyncExecutor = async ({ document, variables }) => {
  const query = print(document);
  const fetchResult = await fetch(HTTP_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  return fetchResult.json();
};

export const getRemoteSchema = async () => {
  const schema = wrapSchema({
    schema: await introspectSchema(executor),
    executor,
  });

  return schema;
};
