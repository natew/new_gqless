import Fastify from 'fastify';
import { defaults, keyBy } from 'lodash';
import mercurius, { IResolvers, MercuriusLoaders } from 'mercurius';
import { codegenMercurius, gql } from 'mercurius-codegen';
import { NextApiHandler } from 'next';
import { JsonDB } from 'node-json-db';
import { Config } from 'node-json-db/dist/lib/JsonDBConfig';
import { name, seed } from 'faker';

import { writeGenerate } from '@dish/gqless-cli';

import type { Dog, Human } from '../../graphql/mercurius';

const app = Fastify();

const db = new JsonDB(new Config('db.json', true, true, '/'));

seed(2021);

const paginatedData: {
  id: string;
  name: string;
}[] = new Array(200).fill(0).map((_, index) => {
  return {
    id: index + '',
    name: name.firstName(),
  };
});

db.push('/paginatedData', paginatedData, true);

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
    human1: Human!
    human1Other: Human!
    paginatedHumans(input: ConnectionArgs!): HumansConnection!
  }
  type Mutation {
    renameDog(id: ID!, name: String!): Dog
    renameHuman(id: ID!, name: String!): Human
    other(arg: inputTypeExample!): Int
    createHuman(id: ID!, name: String!): Human!
  }
  input inputTypeExample {
    a: String!
  }
  type HumansConnection {
    pageInfo: PageInfo!
    nodes: [Human!]!
  }
  type PageInfo {
    hasPreviousPage: Boolean!
    hasNextPage: Boolean!
    startCursor: String
    endCursor: String
  }
  input ConnectionArgs {
    first: Int
    after: String

    last: Int
    before: String
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
    human1() {
      return db.getData('/humans')[0];
    },
    human1Other() {
      return db.getData('/humans')[0];
    },
    paginatedHumans(_root, { input: { after, first, last, before } }) {
      let nodes: { id: string; name: string }[];
      let startSlice: number;
      let endSlice: number;
      if (first != null) {
        if (after) {
          const foundIndex = paginatedData.findIndex((v) => v.id === after);
          if (foundIndex === -1) {
            nodes = [];
            startSlice = -1;
            endSlice = paginatedData.length + 1;
          } else {
            endSlice = foundIndex + 1 + first;
            nodes = paginatedData.slice(
              (startSlice = foundIndex + 1),
              endSlice
            );
          }
        } else {
          nodes = paginatedData.slice((startSlice = 0), (endSlice = first));
        }
      } else if (last != null) {
        if (before) {
          const foundIndex = paginatedData.findIndex((v) => v.id === before);
          if (foundIndex === -1) {
            nodes = [];
            startSlice = -1;
            endSlice = paginatedData.length + 1;
          } else {
            nodes = paginatedData.slice(
              (startSlice = Math.max(0, foundIndex - last)),
              (endSlice = foundIndex)
            );
          }
        } else {
          nodes = paginatedData.slice(
            (startSlice = paginatedData.length - last),
            (endSlice = paginatedData.length)
          );
        }
      } else {
        throw Error('You have to specify pagination arguments');
      }

      const startCursor = nodes[0]?.id;
      const endCursor = nodes[nodes.length - 1]?.id;

      const hasNextPage = endCursor
        ? paginatedData.findIndex((v) => v.id === endCursor) + 1 <
          paginatedData.length
        : false;

      const hasPreviousPage = startCursor
        ? paginatedData.findIndex((v) => v.id === startCursor) - 1 >= 0
        : false;

      return {
        nodes,
        pageInfo: {
          startCursor,
          endCursor,
          hasNextPage,
          hasPreviousPage,
        },
      };
    },
  },
  Mutation: {
    createHuman(_root, { id, name }) {
      initialHumans.push({ id: parseInt(id), name });
      db.push('/humans', initialHumans, true);

      return { id, name };
    },
    renameDog(_root, { id, name }) {
      const dog = initialDogs.find((v) => {
        return v.id + '' === id;
      });

      if (dog) {
        dog.name = name;
        db.push('/dogs', initialDogs, true);
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
