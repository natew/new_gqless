export const schemaJSON = {
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
    objectArray: Array<Human>;
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

const globalSelectionKeys: string[][] = [];

const createTypeProxy = (
  schemaType: SchemaJSONType[string],
  schema: SchemaJSONType,
  selectionKeysArg: string[]
) => {
  return new Proxy(
    Object.fromEntries(
      Object.keys(schemaType).map((key) => {
        return [key, {}];
      })
    ) as Record<string, unknown>,
    {
      get(target, key: string, receiver) {
        if (!schemaType.hasOwnProperty(key)) return Reflect.get(target, key, receiver);

        const value = schemaType[key];
        if (value) {
          let selectionKeys = [...selectionKeysArg];

          selectionKeys.push(key);

          const { __type, __args } = value;
          const { pureType, isArray } = (() => {
            let isNullable = true;
            let nullableItems = true;
            let isArray = false;
            let pureType = __type;
            if (__type.endsWith("!")) {
              isNullable = false;
              pureType = __type.slice(0, __type.length - 1);
            }
            if (pureType.startsWith("[")) {
              pureType = pureType.slice(1, pureType.length - 1);
              isArray = true;
              if (pureType.endsWith("!")) {
                nullableItems = false;
                pureType = pureType.slice(0, pureType.length - 1);
              }
            }

            return {
              pureType,
              isNullable,
              nullableItems,
              isArray,
            };
          })();

          const resolve = (): any => {
            if (scalars[pureType]) {
              globalSelectionKeys.push(selectionKeys);

              // TODO Cache

              if (isArray) {
                return [`Scalar item with key ${key}`];
              }
              return `Scalar with key ${key}`;
            }

            const typeValue = schema[pureType];
            if (typeValue) {
              console.log(`recursive type ${key}`);
              if (isArray) {
                return [createTypeProxy(typeValue, schema, selectionKeys)];
              }
              return createTypeProxy(typeValue, schema, selectionKeys);
            }

            throw Error("97 Not found!");
          };

          if (__args) {
            return (args: typeof __args) => {
              console.log(`args fn ${key}: "${JSON.stringify(args)}"`);
              return resolve();
            };
          }

          return resolve();
        } else {
          Reflect.get(target, key, receiver);
        }
        console.error("Not found", key);

        throw Error(`83. Not found`);
      },
    }
  );
};

const createSchemaProxy = (schema: SchemaJSONType) => {
  return new Proxy(
    Object.fromEntries(
      Object.keys(schema).map((key) => {
        return [key, {}];
      })
    ) as Record<string, unknown>,
    {
      get(_target, key: string, _receiver) {
        const value = schema[key];

        if (value) {
          const selectionKeys: string[] = [];
          selectionKeys.push(key);
          return createTypeProxy(value, schema, selectionKeys);
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

const printAndCleanSelectionKeys = () => {
  console.log("\n-----------------");
  console.log(`selections: \n-> ${globalSelectionKeys.join("\n-> ")}`);
  console.log("-----------------\n");
  globalSelectionKeys.splice(0, globalSelectionKeys.length);
};

printAndCleanSelectionKeys();

console.log(`generatedClient.Query.simpleString: "${generatedClient.Query.simpleString}"`);

printAndCleanSelectionKeys();

console.log(
  `generatedClient.Query.objectWithArgs({who: "xd",}).name: "${
    generatedClient.Query.objectWithArgs({
      who: "xd",
    }).name
  }"`
);

printAndCleanSelectionKeys();

console.log(`generatedClient.Query.object.name: "${generatedClient.Query.object.name}"`);

printAndCleanSelectionKeys();

console.log(`recursive human: "${generatedClient.Query.object.father.father.father.name}"`);

printAndCleanSelectionKeys();

console.log(`array strings: ${generatedClient.Query.arrayString.join("|")}`);

printAndCleanSelectionKeys();

console.log(
  `array object ${JSON.stringify(
    generatedClient.Query.objectArray.map((v) => {
      return {
        father: v.father.name,
        name: v.name,
      };
    })
  )}`
);

printAndCleanSelectionKeys();

console.log(
  `array objects fn: ${generatedClient.Query.arrayObjectArgs({
    limit: 10,
  }).map((v) => {
    return {
      a: v.father.name,
      b: v.name,
    };
  })}`
);

printAndCleanSelectionKeys();

const middleObject = generatedClient.Query.object;

middleObject.father.father.father.father.father.father.name;

middleObject.father.name;

printAndCleanSelectionKeys();
