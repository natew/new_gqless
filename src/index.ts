export interface Type {
  __args?: Record<string, string>;
  __type: string;
}

export interface Schema extends Record<string, Record<string, Type>> {
  Query: Record<string, Type>;
}
export interface Scalars extends Record<string, unknown> {
  String: string;
  Int: number;
}

export type ScalarsHash = { readonly [P in keyof Scalars]: true };

export const createClient = <GeneratedSchema = never>({
  schema,
  scalars,
}: {
  schema: Schema;
  scalars: ScalarsHash;
}) => {
  const globalSelectionKeys: string[][] = [];

  const createTypeProxy = (schemaType: Schema[string], selectionKeysArg: string[]) => {
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
            const { __type, __args } = value;

            let selectionKeys = [...selectionKeysArg];

            selectionKeys.push(key);

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

            const resolve = (): unknown => {
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
                  return [createTypeProxy(typeValue, selectionKeys)];
                }
                return createTypeProxy(typeValue, selectionKeys);
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
          }
          console.error("Not found", key);

          throw Error(`83. Not found`);
        },
      }
    );
  };

  const createSchemaProxy = () => {
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
            return createTypeProxy(value, selectionKeys);
          }
          throw Error("104. Not found");
        },
      }
    );
  };

  return {
    client: createSchemaProxy() as GeneratedSchema,
    globalSelectionKeys,
  };
};
