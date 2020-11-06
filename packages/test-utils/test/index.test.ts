import fs from 'fs';
import { resolve } from 'path';

import { createTestApp } from '../src';

const { readFile } = fs.promises;

test('create test app with codegen', async () => {
  const codegenPath = resolve('./test/_generated.ts');
  const { client, isReady } = createTestApp(
    {
      schema: `
      type Query {
        hello: String!
      }
      `,
      resolvers: {
        Query: {
          hello(_root) {
            return 'hello world';
          },
        },
      },
    },
    {
      codegenPath,
    }
  );

  await isReady;

  expect(
    await readFile(codegenPath, {
      encoding: 'utf-8',
    })
  ).toMatchSnapshot();

  await client
    .query(
      `
    query {
      hello
    }
    `
    )
    .then((response) => {
      expect(response).toEqual({
        data: {
          hello: 'hello world',
        },
      });
    });
});

test('create test app without codegen', async () => {
  const { client, isReady } = createTestApp({
    schema: `
      type Query {
        hello: String!
      }
      `,
    resolvers: {
      Query: {
        hello(_root) {
          return 'hello world';
        },
      },
    },
  });

  await isReady;

  await client
    .query(
      `
    query {
      hello
    }
    `
    )
    .then((response) => {
      expect(response).toEqual({
        data: {
          hello: 'hello world',
        },
      });
    });
});
