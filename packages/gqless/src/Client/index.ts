import { createCache } from "../Cache";
import { buildQuery } from "../QueryBuilder";
import { Selection } from "../Selection/selection";
import { QueryFetcher, ScalarsHash, Schema } from "../types";

export function createClient<GeneratedSchema = never>(
  schema: Readonly<Schema>,
  scalars: ScalarsHash,
  queryFetcher: QueryFetcher
) {
  const globalSelections = new Set<Selection>();
  const client: GeneratedSchema = createSchemaProxy();
  const { getCacheFromSelection, setCacheFromSelection } = createCache();

  async function resolveAllSelections(): Promise<number> {
    const selections = [...globalSelections];
    const { query, variables } = buildQuery(selections);
    const length = selections.length;
    const { data } = await queryFetcher(query, variables);

    if (data) {
      for (const selection of selections) {
        setCacheFromSelection(selection, data);

        globalSelections.delete(selection);
      }
    }

    return length;
  }

  function createTypeProxy(schemaType: Schema[string], selectionsArg: Selection) {
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

            const selection = new Selection({
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
                globalSelections.add(selection);

                return getCacheFromSelection(selection);

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
  }

  function createSchemaProxy() {
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
    ) as GeneratedSchema;
  }

  return {
    client,
    globalSelections,
    resolveAllSelections,
  };
}
