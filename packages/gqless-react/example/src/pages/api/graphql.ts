import Fastify from 'fastify';
import { defaults, keyBy } from 'lodash';
import mercurius, { IResolvers, MercuriusLoaders } from 'mercurius';
import { codegenMercurius, gql } from 'mercurius-codegen';
import { NextApiHandler } from 'next';
import { JsonDB } from 'node-json-db';
import { Config } from 'node-json-db/dist/lib/JsonDBConfig';

import { writeGenerate } from '@dish/gqless-cli';

import type { Dog, Human } from '../../graphql/mercurius';

const app = Fastify();

const db = new JsonDB(new Config('db.json', true, true, '/'));

const initialDogs = [
  {
    id: 1,
    name: 'a',
  },
  {
    id: 2,
    name: 'b',
  },
  {
    id: 3,
    name: 'c',
  },
  {
    id: 4,
    name: 'd',
  },
];
db.push('/dogs', initialDogs, true);

const initialHumans = [
  {
    id: 1,
    name: 'g',
  },
  {
    id: 2,
    name: 'h',
  },
];

db.push('/humans', initialHumans, true);

db.push('/dogOwners', {
  1: 1,
  2: 1,
  3: 2,
});

const schema = gql`
  type Dog {
    id: ID!
    name: String!
    owner: Human
  }
  type Human {
    id: ID!
    name: String!
    dogs: [Dog!]
  }
  type Query {
    expectedError: Boolean!
    expectedNullableError: Boolean
    thirdTry: Boolean!
    dogs: [Dog!]!
    time: String!
    stringList: [String!]!
    humans: [Human!]!
  }
  type Mutation {
    renameDog(id: ID!, name: String!): Dog
    renameHuman(id: ID!, name: String!): Human
    other(arg: inputTypeExample!): Int
  }
  input inputTypeExample {
    a: String!
  }
`;

let nTries = 0;

const resolvers: IResolvers = {
  Query: {
    humans() {
      return db.getData('/humans');
    },
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
    async expectedNullableError() {
      throw Error('Expected error');
    },
    async thirdTry() {
      if (++nTries >= 3) {
        nTries = 0;
        return true;
      }
      throw Error('nTries=' + nTries);
    },
  },
  Mutation: {
    renameDog(_root, { id, name }) {
      const dog = initialDogs.find((v) => {
        return v.id + '' === id;
      });

      if (dog) {
        db.push('/dogs', initialDogs, true);
        dog.name = name;
        return {
          ...dog,
          id: dog.id + '',
        };
      }

      return null;
    },
    renameHuman(_root, { id, name }) {
      const human = initialHumans.find((v) => {
        return v.id + '' === id;
      });

      if (human) {
        human.name = name;
        db.push('/humans', initialHumans, true);
        return {
          ...human,
          id: human.id + '',
        };
      }

      return null;
    },
  },
};
const loaders: MercuriusLoaders = {
  Dog: {
    async owner(queries) {
      const dogOwners: Record<string, string> = db.getData('/dogOwners');
      const humans = keyBy(db.getData('/humans') as Array<Human>, 'id');
      return queries.map(({ obj }) => {
        return humans[dogOwners[obj.id]];
      });
    },
  },
  Human: {
    async dogs(queries) {
      const dogOwners: Record<number, number> = db.getData('/dogOwners');

      const dogs = db.getData('/dogs');

      const humanDogs = Object.entries(dogOwners).reduce(
        (acum, [dogId, humanId]) => {
          defaults(acum, {
            [humanId]: [],
          });

          const dog = dogs.find((v: Dog) => v.id == dogId);
          if (dog) acum[humanId].push(dog);

          return acum;
        },
        {} as Record<string, Dog[]>
      );

      return queries.map(({ obj }) => {
        return humanDogs[obj.id]?.map((dog) => dog);
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
