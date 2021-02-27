import { createTestApp, gql } from 'test-utils';

import { generate } from '../src';

export const clientPreComment = '';

test('basic functionality works', async () => {
  const { server, isReady } = createTestApp({
    schema: gql`
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

  const {
    schemaCode,
    clientCode,
    generatedSchema,
    scalarsEnumsHash,
  } = await generate(server.graphql.schema, {
    preImport: `
        ${shouldBeIncluded}
        `,
    react: true,
  });

  expect(schemaCode).toMatchSnapshot('generate_code');

  expect(clientCode).toMatchSnapshot('generate_client_code');

  expect(JSON.stringify(generatedSchema, null, 2)).toMatchSnapshot(
    'generate_generatedSchema'
  );

  expect(JSON.stringify(scalarsEnumsHash, null, 2)).toMatchSnapshot(
    'generate_scalarsEnumHash'
  );

  expect(clientCode.includes('= createReactClient')).toBeTruthy();

  expect(
    schemaCode
      .split('\n')
      .slice(3)
      .join('\n')
      .trim()
      .startsWith(shouldBeIncluded)
  ).toBeTruthy();
});

test('custom scalars works', async () => {
  const { server, isReady } = createTestApp({
    schema: gql`
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

  const {
    schemaCode,
    clientCode,
    generatedSchema,
    scalarsEnumsHash,
  } = await generate(server.graphql.schema, {
    scalars: {
      Custom: '"hello world"',
    },
  });

  expect(clientCode).toMatchSnapshot('generate_client_code');

  expect(schemaCode).toMatchSnapshot('generate_code');

  expect(JSON.stringify(generatedSchema, null, 2)).toMatchSnapshot(
    'generate_customScalars_generatedSchema'
  );

  expect(JSON.stringify(scalarsEnumsHash, null, 2)).toMatchSnapshot(
    'generate_customScalars_scalarsEnumHash'
  );

  expect(
    schemaCode.includes(
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
  const { server, isReady } = createTestApp({
    schema: gql`
      scalar ExampleScalar

      enum GreetingsEnum {
        Hello
        Hi
        Hey
      }
      input GreetingsInput {
        language: String!
        value: String
        scal: ExampleScalar
      }
      type Query {
        simpleString: String!
        stringWithArgs(hello: String!): String!
        stringNullableWithArgs(hello: String!, helloTwo: String): String
        stringNullableWithArgsArray(hello: [String]!): String
        object: Human
        objectArray: [Human]
        objectWithArgs(who: String!): Human!
        arrayString: [String!]!
        arrayObjectArgs(limit: Int): [Human!]!
        greetings: GreetingsEnum!
        giveGreetingsInput(input: GreetingsInput!): String!
        number: Int!
      }
      type Mutation {
        increment(n: Int!): Int!
      }
      interface NamedEntity {
        name: String!
        other: String
        withArgs(a: Int!, b: Int): Int
        withArgs2(a: Int): Int!
      }
      type Human implements NamedEntity {
        name: String!
        other: String
        father: Human!
        fieldWithArgs(id: Int!): Int!
        withArgs(a: Int!, b: Int): Int
        withArgs2(a: Int): Int!
      }
      type OtherHuman {
        name: String!
        other: String
        withArgs(a: Int!, b: Int): Int
        withArgs2(a: Int): Int!
      }
      union HumanType = Human | OtherHuman
    `,
    resolvers: {},
  });
  beforeAll(async () => {
    await isReady;
  });
  test('generate works', async () => {
    const { schemaCode, generatedSchema, scalarsEnumsHash } = await generate(
      server.graphql.schema
    );

    expect(schemaCode).toMatchSnapshot('featureComplete_code');
    expect(JSON.stringify(generatedSchema)).toMatchSnapshot(
      'featureComplete_generatedSchema'
    );
    expect(JSON.stringify(scalarsEnumsHash)).toMatchSnapshot(
      'featureComplete_scalarsEnumsHash'
    );
  });
});

test('prettier detects invalid code', async () => {
  const { server, isReady } = createTestApp({
    schema: gql`
      type Query {
        hello: String!
      }
    `,
  });
  await isReady;

  await expect(
    generate(server.graphql.schema, {
      preImport: `
        con a; // invalid code
        `,
    })
  ).rejects.toThrow("';' expected. (6:13)");
});

describe('mutation', () => {
  const { server, isReady } = createTestApp({
    schema: gql`
      type Query {
        hello: String!
      }
      type Mutation {
        helloMutation(hello: String!): String!
      }
    `,
    resolvers: {
      Mutation: {
        helloMutation(_root, { hello }: { hello: string }) {
          return hello;
        },
      },
    },
  });

  beforeAll(async () => {
    await isReady;
  });

  test('generates mutation', async () => {
    const { schemaCode, generatedSchema, scalarsEnumsHash } = await generate(
      server.graphql.schema
    );

    expect(schemaCode).toMatchSnapshot('mutation_code');
    expect(generatedSchema).toMatchSnapshot('mutation_generatedSchema');
    expect(scalarsEnumsHash).toMatchSnapshot('mutation_scalarsEnumHash');
  });
});

describe('subscription', () => {
  const { server, isReady } = createTestApp({
    schema: gql`
      type Query {
        hello: String!
      }
      type Subscription {
        newNotification: String!
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

  beforeAll(async () => {
    await isReady;
  });

  test('generates subscription', async () => {
    const { schemaCode, generatedSchema, scalarsEnumsHash } = await generate(
      server.graphql.schema
    );

    expect(schemaCode).toMatchSnapshot('subscription_code');
    expect(generatedSchema).toMatchSnapshot('subscription_generatedSchema');
    expect(scalarsEnumsHash).toMatchSnapshot('subscription_scalarsEnumHash');
  });
});
