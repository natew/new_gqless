import { selectFields } from '../src';
import { createTestClient } from './utils';

test('works', async () => {
  const {
    query,
    scheduler,
    resolved,
    setCache,
    cache,
  } = await createTestClient();

  await resolved(() => query.human().sons.map((v) => selectFields(v)));

  let humanA = query.human({
    name: 'asd',
  });

  setCache(humanA, {
    name: 'asd',
  });

  expect(humanA.name).toBe('asd');
  expect(scheduler.resolving).toBe(null);

  setCache(
    query.human,
    { name: 'zxc' },
    {
      name: 'tyu',
    }
  );

  const humanB = query.human({
    name: 'zxc',
  });

  expect(scheduler.resolving).toBe(null);

  expect(humanB.name).toBe('tyu');

  expect(scheduler.resolving).toBe(null);

  query.human().sons = [];

  const xd = (query.hello = 'XDXD');

  expect(xd).toBe('XDXD');

  expect(scheduler.resolving).toBe(null);

  const hello = query.hello;

  expect(hello).toBe('XDXD');

  expect(query.human().sons).toEqual([]);

  expect(scheduler.resolving).toBe(null);

  console.log(54, cache);

  setCache(query, {
    hello: 'ppp',
  });

  console.log(64, cache);
});
