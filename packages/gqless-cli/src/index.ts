import { fetch } from 'cross-fetch';
import { print } from 'graphql';
import { get } from 'lodash';

import { AsyncExecutor } from '@graphql-tools/delegate';
import { introspectSchema, wrapSchema } from '@graphql-tools/wrap';

const executor: AsyncExecutor = async ({ document, variables, context }) => {
  const HTTP_GRAPHQL_ENDPOINT = get(
    context,
    'endpoint',
    'http://localhost:3000/graphql'
  );
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

export const getRemoteSchema = async (endpoint?: string) => {
  const schema = wrapSchema({
    schema: await introspectSchema(executor, {
      endpoint,
    }),
    executor,
  });

  return schema;
};
