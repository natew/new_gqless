import Fastify from 'fastify';
import { defaults, keyBy } from 'lodash';
import mercurius, { IResolvers, MercuriusLoaders } from 'mercurius';
import { codegenMercurius, gql } from 'mercurius-codegen';
import { NextApiHandler } from 'next';
import { JsonDB } from 'node-json-db';
import { Config } from 'node-json-db/dist/lib/JsonDBConfig';

import { writeGenerate } from '@dish/gqless-cli';

import type { Human } from '../../graphql/mercurius';

const app = Fastify();

const db = new JsonDB(new Config('db.json', true, true, '/'));

db.push(
  '/dogs',
  [
    {
      name: 'a',
    },
    {
      name: 'b',
    },
    {
      name: 'c',
    },
    {
      name: 'd',
    },
  ],
  true
);

db.push(
  '/humans',
  [
    {
      name: 'g',
    },
    {
      name: 'h',
    },
  ],
  true
);

db.push('/dogOwners', {
  a: 'g',
  b: 'g',
  c: 'h',
});

const schema = gql`
  type Dog {
    name: String!
    owner: Human
  }
  type Human {
    name: String!
    dogs: [Dog!]
  }
  type Query {
    expectedError: Boolean
    dogs: [Dog!]!
    time: String!
    stringList: [String!]!
  }
`;

const resolvers: IResolvers = {
  Query: {
    stringList() {
      return ['a', 'b', 'c'];
    },
    async dogs() {
      return db.getData('/dogs');
    },
    time() {
      return new Date().toISOString();
    },
    async expectedError() {
      throw Error('Expected error');
    },
  },
};
const loaders: MercuriusLoaders = {
  Dog: {
    async owner(queries) {
      const dogOwners: Record<string, string> = db.getData('/dogOwners');
      const humans = keyBy(db.getData('/humans') as Array<Human>, 'name');
      return queries.map(({ obj }) => {
        return humans[dogOwners[obj.name]];
      });
    },
  },
  Human: {
    async dogs(queries) {
      const dogOwners: Record<string, string> = db.getData('/dogOwners');

      const humanDogs = Object.entries(dogOwners).reduce(
        (acum, [dogName, humanName]) => {
          defaults(acum, {
            [humanName]: [],
          });

          acum[humanName].push(dogName);

          return acum;
        },
        {} as Record<string, string[]>
      );

      return queries.map(({ obj }) => {
        return humanDogs[obj.name]?.map((name) => ({
          name,
        }));
      });
    },
  },
};

app.register(mercurius, {
  schema,
  resolvers,
  loaders,
});

codegenMercurius(app, {
  targetPath: './src/graphql/mercurius.ts',
  silent: true,
}).catch(console.error);

const ready = new Promise<void>(async (resolve) => {
  await app.ready();

  writeGenerate(app.graphql.schema, './src/graphql/gqless.ts', {}).catch(
    console.error
  );

  resolve();
});

const GraphQLRoute: NextApiHandler = async (req, res) => {
  await ready;

  const response = await app.inject({
    method: req.method as any,
    headers: req.headers,
    payload: req.body,
    query: req.query,
    url: '/graphql',
  });

  res.send(response.body);
};

export default GraphQLRoute;
