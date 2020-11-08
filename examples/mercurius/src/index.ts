import Fastify, { LogLevel } from 'fastify';
import { random, range } from 'lodash';
import Mercurius from 'mercurius';
import mercuriusCodegen from 'mercurius-codegen';
import { generate } from 'randomstring';

import { GreetingsEnum } from './generated/mercurius';

export const app = Fastify({
  logger: {
    level: 'warn' as LogLevel,
  },
});

export const newHuman = ({ name }: { name?: string } = {}) => {
  return {
    name: name || generate(),
  };
};

app.register(Mercurius, {
  schema: `
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
        arrayObjectArgs(limit: Int!): [Human!]!
        greetings: GreetingsEnum!
        giveGreetingsInput(input: GreetingsInput!): String!
    }
    type Human {
      name: String!
      father: Human!
      fieldWithArgs(id: Int!): Int!
    }
    `,
  resolvers: {
    Query: {
      simpleString() {
        return generate();
      },
      stringWithArgs(_root, { hello }) {
        return hello;
      },
      object() {
        return newHuman();
      },
      objectArray() {
        return range(random(1, 10)).map(() => newHuman());
      },
      objectWithArgs(_root, { who }) {
        return newHuman({ name: who });
      },
      arrayString() {
        return range(random(1, 10)).map(() => generate());
      },
      arrayObjectArgs(_root, { limit }) {
        return range(limit).map(() => newHuman());
      },
      giveGreetingsInput(_root, { input }) {
        return input.language;
      },
      greetings() {
        return GreetingsEnum.Hello;
      },
      stringNullableWithArgs(_root, { hello, helloTwo }) {
        return hello || helloTwo;
      },
      stringNullableWithArgsArray(_root, { hello }) {
        return hello[0];
      },
    },
    Human: {
      father() {
        return newHuman();
      },
      fieldWithArgs(_root, { id }) {
        return id;
      },
    },
  },
});

export const codegen = () =>
  mercuriusCodegen(app, {
    targetPath: './src/generated/mercurius.ts',
    silent: true,
  });
