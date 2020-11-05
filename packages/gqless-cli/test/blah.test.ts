import { createTestApp } from 'test-utils';

import { getRemoteSchema, generate } from '../src';

const { server } = createTestApp({
  schema: `
  type Query {
    hello: String!
  }
`,
  resolvers: {
    Query: {
      hello() {
        return 'hello world';
      },
    },
  },
});

let endpoint: string;
beforeAll(async () => {
  const listenAddress = await server.listen(0);

  endpoint = listenAddress + '/graphql';
});

afterAll(async () => {
  await server.close();
});

describe('works', () => {
  it('works', async () => {
    const schema = await getRemoteSchema(endpoint);

    expect((await generate(schema)).code).toBeTruthy();
  });
});
