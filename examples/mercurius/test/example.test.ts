import { createMercuriusTestClient } from 'mercurius-integration-testing';

import { app } from '../src';
import { client as generatedClient, resolved } from '../src/generated/gqless';

const testClient = createMercuriusTestClient(app);

test('works', async () => {
  await testClient
    .query(
      `
    query {
        simpleString
    }
    `
    )
    .then((response) => {
      expect(typeof response.data?.simpleString).toBe('string');
    });

  await testClient
    .query(
      `
    query {
      arrayObjectArgs(limit: 2) {
        name
        father {
          name
          father {
            name
          }
        }
      }
    }
  `
    )
    .then((resp) => {
      expect(resp.errors).toBe(undefined);
    });
});

test('multiple args', async () => {
  const response = await testClient.query(`
  query {
    a1: objectWithArgs(who: "hello") {
      zxc: name
      abc: name
    }
    a2: objectWithArgs(who: "hello2") {
      name
    }
  }
  `);

  expect(response).toEqual({
    data: {
      a1: {
        zxc: 'hello',
        abc: 'hello',
      },
      a2: {
        name: 'hello2',
      },
    },
  });
});

test('generatedClient', async () => {
  const anon = generatedClient.query.objectWithArgs({
    who: 'anon',
  });

  const { name, fatherName } = await resolved(() => {
    return {
      name: anon.name,
      fatherName: anon.father.father.name,
    };
  });

  expect(typeof name).toBe('string');

  expect(typeof fatherName).toBe('string');

  expect(typeof anon.name).toBe('string');

  expect(typeof anon.father.father.name).toBe('string');

  const arrayDataAfterResolved = await resolved(() => {
    return generatedClient.query.objectArray?.map((v) => v?.name);
  });

  expect((arrayDataAfterResolved?.length ?? 0) > 0).toBeTruthy();

  expect(
    arrayDataAfterResolved?.every((v) => typeof v === 'string' && v.length > 30)
  ).toBeTruthy();
});

test('args', async () => {
  const name = await resolved(() => {
    return generatedClient.query.objectWithArgs({
      who: 'asd',
    }).name;
  });

  expect(name).toBe('asd');
});

test('refetch works', async () => {
  const firstHumanName = await resolved(() => {
    return generatedClient.query.object?.name;
  });

  expect((firstHumanName?.length ?? 0) > 20).toBeTruthy();

  const secondHumanName = await resolved(
    () => {
      return generatedClient.query.object?.name;
    },
    {
      refetch: true,
    }
  );

  expect((secondHumanName?.length ?? 0) > 20).toBeTruthy();

  expect(firstHumanName !== secondHumanName).toBeTruthy();
});

test('scheduler', async () => {
  const hello = 'zxczxc';
  const shoudBeNull = generatedClient.query.stringWithArgs({
    hello,
  });

  expect(shoudBeNull).toBe(null);

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const shouldBeString = generatedClient.query.stringWithArgs({
    hello,
  });

  expect(shouldBeString).toBe(hello);
});

test('resolved no cache', async () => {
  const hello = 'asdasd';
  const helloQueryString = await resolved(
    () => {
      return generatedClient.query.stringWithArgs({
        hello,
      });
    },
    {
      noCache: true,
    }
  );

  expect(helloQueryString).toBe(hello);

  const shouldBeNull = generatedClient.query.stringWithArgs({
    hello,
  });

  expect(shouldBeNull).toBe(null);
});
