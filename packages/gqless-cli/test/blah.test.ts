import { app } from 'mercurius-example';

import { getRemoteSchema, generate } from '../src';

let endpoint: string;
beforeAll(async () => {
  const listenAddress = await app.listen(0);

  endpoint = listenAddress + '/graphql';
});

afterAll(async () => {
  await app.close();
});

describe('works', () => {
  it('works', async () => {
    const schema = await getRemoteSchema(endpoint);

    console.log((await generate(schema)).code);
  });
});
