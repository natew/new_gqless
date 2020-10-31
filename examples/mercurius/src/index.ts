import Fastify from "fastify";
import Mercurius, { IResolvers } from "mercurius";
import { generate } from "randomstring";
import { range, random } from "lodash";

export const app = Fastify({
  logger: {
    level: "info",
  },
});

export const newHuman = ({ name }: { name?: string } = {}) => {
  return {
    name: name || generate(),
  };
};

const resolvers: IResolvers = {
  Query: {
    simpleString() {
      return generate();
    },
    stringWithArgs(_root, { hello }: { hello: string }) {
      return hello;
    },
    object() {
      return newHuman();
    },
    objectArray() {
      return range(random(1, 10)).map(() => newHuman());
    },
    objectWithArgs(_root, { who }: { who: string }) {
      return newHuman({ name: who });
    },
    arrayString() {
      return range(random(1, 10)).map(() => generate());
    },
    arrayObjectArgs(_root, { limit }: { limit: number }) {
      return range(limit).map(() => newHuman());
    },
  },
  Human: {
    father() {
      return newHuman();
    },
  },
};

app.register(Mercurius, {
  schema: `
    type Query {
        simpleString: String!
        stringWithArgs(hello: String!): String!
        object: Human!
        objectArray: [Human!]!
        objectWithArgs(who: String!): Human!
        arrayString: [String!]!
        arrayObjectArgs(limit: Int!): [Human!]!
    }
    type Human {
      name: String!
      father: Human!
    }
    `,
  resolvers,
});
