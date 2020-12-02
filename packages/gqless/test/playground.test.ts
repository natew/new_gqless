import { selectFields } from '../src';
import { createTestClient } from './utils';

test('works', async () => {
  const { query, scheduler, resolved } = await createTestClient();

  await resolved(() => query.human().sons.map((v) => selectFields(v)));

  query.human().sons = query.human().sons;
  //   query.stringArg({arg: "asd"}) = 123

  const xd = (query.hello = 'XDXD');

  expect(xd).toBe('XDXD');
  expect(scheduler.resolving).toBe(null);

  const hello = query.hello;

  expect(hello).toBe(null);

  expect(scheduler.resolving).toBeTruthy();

  await scheduler.resolving?.promise;

  expect(query.hello).toBe('hello world');
});
