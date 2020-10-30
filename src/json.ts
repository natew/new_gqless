const schemaJSON = {
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

interface SchemaType {
  __args?: Record<string, string>;
  __type: string;
}

interface SchemaJSONType extends Record<string, Record<string, SchemaType>> {
  Query: Record<string, SchemaType>;
}

interface Scalars extends Record<string, unknown> {
  String: string;
  Int: number;
}

interface Human {
  name: Scalars["String"];
  father: Human;
}

interface GeneratedSchema {
  Query: {
    simpleString: Scalars["String"];
    stringWithArgs: (args: { hello: Scalars["String"] }) => Scalars["String"];
    object: Human;
    objectWithArgs: (args: { who: Scalars["String"] }) => Human;
    arrayString: Array<Scalars["String"]>;
    arrayObjectArgs: (args: { limit: Scalars["Int"] }) => Array<Human>;
  };
}

declare const transformedSchema: GeneratedSchema;

const scalars: Record<string, true | undefined> = {
  String: true,
  Int: true,
};

const createTypeProxy = (schemaType: SchemaJSONType[string], schema: SchemaJSONType) => {
  return new Proxy(
    Object.fromEntries(
      Object.keys(schemaType).map((key) => {
        return [key, undefined];
      })
    ) as Record<string, unknown>,
    {
      get(_target, key: string, _receiver) {
        const value = schemaType[key];

        if (value) {
          const { __type, __args } = value;
          const pureType = (() => {
            if (__type.endsWith("!")) {
              return __type.slice(0, __type.length - 1);
            }
            return __type;
          })();
          const resolve = (): any => {
            if (scalars[pureType]) {
              // TODO Cache
              return `Scalar with key ${key}`;
            }
            const typeValue = schema[pureType];
            if (typeValue) {
              console.log(`recursive type ${key}`);
              return createTypeProxy(typeValue, schema);
            }

            throw Error("97 Not found!");
          };
          if (__args) {
            return (args: typeof __args) => {
              console.log(89, args);
              return resolve();
            };
          }

          return resolve();
        }
        throw Error("83. Not found");
      },
    }
  );
};

const createSchemaProxy = (schema: SchemaJSONType) => {
  return new Proxy(
    Object.fromEntries(
      Object.keys(schema).map((key) => {
        return [key, undefined];
      })
    ) as Record<string, unknown>,
    {
      get(_target, key: string, _receiver) {
        const value = schema[key];

        if (value) {
          return createTypeProxy(value, schema);
        }
        throw Error("104. Not found");
      },
    }
  );
};

const createJSONClient = <T extends SchemaJSONType>(schema: T): GeneratedSchema => {
  const proxy = createSchemaProxy(schema);

  return proxy as any;
};

const generatedClient = createJSONClient(schemaJSON);

console.log(`generatedClient.Query.simpleString: "${generatedClient.Query.simpleString}"`);

console.log(
  `generatedClient.Query.objectWithArgs({who: "xd",}).name: "${
    generatedClient.Query.objectWithArgs({
      who: "xd",
    }).name
  }"`
);

console.log(`generatedClient.Query.object.name: "${generatedClient.Query.object.name}"`);

console.log(`recursive human: "${generatedClient.Query.object.father.father.father.name}"`);
