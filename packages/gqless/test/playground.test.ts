import { selectFields } from '../src';
import { createTestClient } from './utils';

test('works', async () => {
  const {
    query,
    scheduler,
    resolved,
    setAccessorCache,
  } = await createTestClient();

  await resolved(() => query.human().sons.map((v) => selectFields(v)));

  let humanA = query.human();

  setAccessorCache(humanA, {
    name: 'asd',
  });

  const a = query.stringArg({ arg: 'asd' });

  setAccessorCache(a, 'asd');

  // query.human = {}
  query.human().sons = [];
  //   query.stringArg({arg: "asd"}) = 123

  const xd = (query.hello = 'XDXD');

  expect(xd).toBe('XDXD');

  expect(scheduler.resolving).toBe(null);

  const hello = query.hello;

  expect(hello).toBe('XDXD');

  expect(query.human().sons).toEqual([]);
});
