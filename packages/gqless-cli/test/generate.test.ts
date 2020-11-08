import { app } from 'mercurius-example';
import { createTestApp } from 'test-utils';

import { generate } from '../src';

test('basic functionality works', async () => {
  const { server, isReady } = createTestApp({
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

  await isReady;

  const shouldBeIncluded = '// This should be included';

  const { code, generatedSchema, scalarsEnumsHash } = await generate(
    server.graphql.schema,
    {
      preImport: `
        ${shouldBeIncluded}
        `,
    }
  );

  expect(code).toMatchSnapshot('generate_code');

  expect(JSON.stringify(generatedSchema, null, 2)).toMatchSnapshot(
    'generate_generatedSchema'
  );

  expect(JSON.stringify(scalarsEnumsHash, null, 2)).toMatchSnapshot(
    'generate_scalarsEnumHash'
  );

  expect(code.startsWith(shouldBeIncluded)).toBeTruthy();
});

test('custom query fetcher', async () => {
  const { server, isReady } = createTestApp({
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

  await isReady;

  const customQueryFetcher = `
const queryFetcher: QueryFetcher = async function (query, variables) {
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: 'bearer <token>',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
    mode: 'cors',
  });

  if (!response.ok) {
    throw new Error(\`Network error, received status code \${response.status}\`);
  }

  const json = await response.json();
};
      `;

  const { code, generatedSchema, scalarsEnumsHash } = await generate(
    server.graphql.schema,
    {
      queryFetcher: customQueryFetcher,
    }
  );

  expect(code).toMatchSnapshot('generate_customQueryFetcher_code');

  expect(JSON.stringify(generatedSchema, null, 2)).toMatchSnapshot(
    'generate_customQueryFetcher_generatedSchema'
  );

  expect(JSON.stringify(scalarsEnumsHash, null, 2)).toMatchSnapshot(
    'generate_customQueryFetcher_scalarsEnumHash'
  );

  expect(code.includes(customQueryFetcher.trim())).toBeTruthy();
});

test('custom scalars works', async () => {
  const { server, isReady } = createTestApp({
    schema: `
          scalar Custom
          type Query {
              hello: Custom!
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

  await isReady;

  const { code, generatedSchema, scalarsEnumsHash } = await generate(
    server.graphql.schema,
    {
      scalars: {
        Custom: '"hello world"',
      },
    }
  );

  expect(code).toMatchSnapshot('generate_code');

  expect(JSON.stringify(generatedSchema, null, 2)).toMatchSnapshot(
    'generate_customScalars_generatedSchema'
  );

  expect(JSON.stringify(scalarsEnumsHash, null, 2)).toMatchSnapshot(
    'generate_customScalars_scalarsEnumHash'
  );

  expect(
    code.includes(
      `
export interface Scalars {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  Custom: 'hello world';
}
`.trim()
    )
  ).toBeTruthy();
});

describe('feature complete app', () => {
  beforeAll(async () => {
    await app.ready();
  });
  test('generate works', async () => {
    const { code, generatedSchema, scalarsEnumsHash } = await generate(
      app.graphql.schema
    );

    expect(code).toMatchSnapshot('featureComplete_code');
    expect(JSON.stringify(generatedSchema)).toMatchSnapshot(
      'featureComplete_generatedSchema'
    );
    expect(JSON.stringify(scalarsEnumsHash)).toMatchSnapshot(
      'featureComplete_scalarsEnumsHash'
    );
  });
});

test('prettier detects invalid code', async () => {
  await expect(
    generate(app.graphql.schema, {
      preImport: `
        con a; // invalid code
        `,
    })
  ).rejects.toThrow("';' expected. (3:13)");
});
