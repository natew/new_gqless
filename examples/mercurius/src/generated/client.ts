import { createClient, QueryFetcher, Scalars, ScalarsHash } from 'gqless';
import { createMercuriusTestClient } from 'mercurius-integration-testing';

import { app } from '../';

export const scalars: ScalarsHash = {
  Int: true,
  String: true,
  ID: true,
};

export const schema = {
  query: {
    simpleString: {
      __type: 'String!',
    },
    stringWithArgs: {
      __args: {
        hello: 'String!',
      },
      __type: 'String!',
    },
    object: {
      __type: 'Human!',
    },
    objectArray: {
      __type: '[Human!]!',
    },
    objectWithArgs: {
      __args: {
        who: 'String!',
      },
      __type: 'Human!',
    },
    arrayString: {
      __type: '[String!]!',
    },
    arrayObjectArgs: {
      __args: {
        limit: 'Int!',
      },
      __type: '[Human!]!',
    },
  },
  Human: {
    name: {
      __type: 'String!',
    },
    father: {
      __type: 'Human!',
    },
  },
} as const;

export interface Human {
  name: Scalars['String'];
  father: Human;
  fieldWithArgs: (args: { id: number }) => Scalars['String'];
}

export interface GeneratedSchema {
  query: {
    simpleString: Scalars['String'];
    stringWithArgs: (args: { hello: Scalars['String'] }) => Scalars['String'];
    object: Human;
    objectArray: Array<Human>;
    objectWithArgs: (args: { who: Scalars['String'] }) => Human;
    arrayString: Array<Scalars['String']>;
    arrayObjectArgs: (args: { limit: Scalars['Int'] }) => Array<Human>;
  };
}

const testClient = createMercuriusTestClient(app);
const queryFetcher: QueryFetcher = function (query, variables) {
  return testClient.query(query, {
    variables,
  });
  // const response = await fetch("/graphql", {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json",
  //   },
  //   body: JSON.stringify({
  //     query,
  //     variables,
  //   }),
  //   mode: "cors",
  // });

  // if (!response.ok) {
  //   throw new Error(`Network error, received status code ${response.status}`);
  // }

  // const json = await response.json();

  // return json;
};

export const { client, resolveAllSelections, resolved } = createClient<
  GeneratedSchema
>(schema, scalars, queryFetcher);
