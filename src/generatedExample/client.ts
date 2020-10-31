import { Scalars, createClient, ScalarsHash } from "../Client/index";

declare module "../types" {
  interface Scalars {
    ID: string;
  }
}

export const scalars: ScalarsHash = {
  Int: true,
  String: true,
  ID: true,
};

export const schema = {
  Query: {
    simpleString: {
      __type: "String!",
    },
    stringWithArgs: {
      __args: {
        hello: "String!",
      },
      __type: "String!",
    },
    object: {
      __type: "Human!",
    },
    objectArray: {
      __type: "[Human!]!",
    },
    objectWithArgs: {
      __args: {
        who: "String!",
      },
      __type: "Human!",
    },
    arrayString: {
      __type: "[String!]!",
    },
    arrayObjectArgs: {
      __args: {
        limit: "Int!",
      },
      __type: "[Human!]!",
    },
  },
  Human: {
    name: {
      __type: "String!",
    },
    father: {
      __type: "Human!",
    },
  },
} as const;

export interface Human {
  name: Scalars["String"];
  father: Human;
}

export interface GeneratedSchema {
  Query: {
    simpleString: Scalars["String"];
    stringWithArgs: (args: { hello: Scalars["String"] }) => Scalars["String"];
    object: Human;
    objectArray: Array<Human>;
    objectWithArgs: (args: { who: Scalars["String"] }) => Human;
    arrayString: Array<Scalars["String"]>;
    arrayObjectArgs: (args: { limit: Scalars["Int"] }) => Array<Human>;
  };
}

export const { client, globalSelectionKeys } = createClient<GeneratedSchema>({
  schema,
  scalars,
});
