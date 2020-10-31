import { Selection } from "../Selection/selection";
import { ScalarsHash, Schema } from "../types";

export const createClient = <GeneratedSchema = never>({
  schema,
  scalars,
}: {
  schema: Schema;
  scalars: ScalarsHash;
}) => {
  const globalSelectionKeys: Selection[] = [];

  const createTypeProxy = (schemaType: Schema[string], selectionsArg: Selection) => {
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

            let selection = new Selection({
              key,
              prevSelection: selectionsArg,
            });

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
                globalSelectionKeys.push(selection);

                // TODO Cache

                if (isArray) {
                  return [`Scalar item with key ${key}`];
                }
                return `Scalar with key ${key}`;
              }

              const typeValue = schema[pureType];
              if (typeValue) {
                if (isArray) {
                  return [createTypeProxy(typeValue, selection)];
                }
                return createTypeProxy(typeValue, selection);
              }

              throw Error("97 Not found!");
            };

            if (__args) {
              return (args: typeof __args) => {
                selection.args = args;
                selection.argTypes = __args;

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
            const selection = new Selection({
              key,
            });

            return createTypeProxy(value, selection);
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

export * from "../types";
