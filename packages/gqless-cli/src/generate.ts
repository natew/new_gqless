import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLUnionType,
  parse,
  printSchema,
} from 'graphql';
import { format, Options as PrettierOptions, resolveConfig } from 'prettier';

import {
  parseSchemaType,
  ScalarsEnumsHash,
  Schema,
  SchemaUnionsKey,
  Type,
} from '@dish/gqless';
import { codegen } from '@graphql-codegen/core';
import * as typescriptPlugin from '@graphql-codegen/typescript';

export type GenerateOptions = {
  /**
   * Add a custom string at the beginning of the file, for example, add imports.
   */
  preImport?: string;
  /**
   * Specify the types of custom scalars
   */
  scalars?: Record<string, string>;
};

export async function generate(
  schema: GraphQLSchema,
  { preImport = '', scalars }: GenerateOptions = {}
) {
  const prettierConfigPromise = resolveConfig(process.cwd()).then((config) =>
    Object.assign({}, config, {
      parser: 'typescript',
    } as PrettierOptions)
  );
  const codegenResultPromise = codegen({
    schema: parse(printSchema(schema)),
    config: {} as typescriptPlugin.TypeScriptPluginConfig,
    documents: [],
    filename: 'gqless.generated.ts',
    pluginMap: {
      typescript: typescriptPlugin,
    },
    plugins: [
      {
        typescript: {
          onlyOperationTypes: true,
          declarationKind: 'interface',
          addUnderscoreToArgsType: true,
          scalars,
          namingConvention: 'keep',
        },
      },
    ],
  });

  const config = schema.toConfig();

  const scalarsEnumsHash: ScalarsEnumsHash = {};

  const enumsNames: string[] = [];

  const inputTypeNames = new Set<string>();

  const generatedSchema: Schema = {
    query: {},
    mutation: {},
    subscription: {},
  };

  const queryType = config.query;
  const mutationType = config.mutation;
  const subscriptionType = config.subscription;

  const parseEnumType = (type: GraphQLEnumType) => {
    scalarsEnumsHash[type.name] = true;
    enumsNames.push(type.name);
  };
  const parseScalarType = (type: GraphQLScalarType) => {
    scalarsEnumsHash[type.name] = true;
  };

  const objectTypeInterfacesMap = new Map<string, string[]>();

  const parseObjectType = (type: GraphQLObjectType, typeName = type.name) => {
    const fields = type.getFields();
    const interfaces = type.getInterfaces();

    if (interfaces.length) {
      objectTypeInterfacesMap.set(
        type.name,
        interfaces.map((v) => v.name)
      );
    }

    const schemaType: Record<string, Type> = {
      __typename: { __type: 'String!' },
    };

    Object.entries(fields).forEach(([key, value]) => {
      schemaType[key] = {
        __type: value.type.toString(),
      };

      if (value.args.length) {
        schemaType[key].__args = value.args.reduce((acum, arg) => {
          acum[arg.name] = arg.type.toString();
          return acum;
        }, {} as Record<string, string>);
      }
    });

    generatedSchema[typeName] = schemaType;
  };

  const unionsMap = new Map<string, string[]>();

  const parseUnionType = (type: GraphQLUnionType) => {
    const unionTypes = type.getTypes();

    const list: string[] = [];
    unionsMap.set(type.name, list);

    for (const objectType of unionTypes) {
      list.push(objectType.name);
    }
  };

  const parseInputType = (type: GraphQLInputObjectType) => {
    inputTypeNames.add(type.name);
    const fields = type.getFields();

    const schemaType: Record<string, Type> = {};

    Object.entries(fields).forEach(([key, value]) => {
      schemaType[key] = {
        __type: value.type.toString(),
      };
    });

    generatedSchema[type.name] = schemaType;
  };

  type InterfaceMapValue = {
    fieldName: string;
  } & Type;
  const interfacesMap = new Map<string, InterfaceMapValue[]>();

  const parseInterfaceType = (type: GraphQLInterfaceType) => {
    const fields = type.getFields();

    const list = Object.entries(fields).map(([fieldName, gqlType]) => {
      const interfaceValue: InterfaceMapValue = {
        fieldName,
        __type: gqlType.type.toString(),
      };

      if (gqlType.args.length) {
        interfaceValue.__args = gqlType.args.reduce((acum, arg) => {
          acum[arg.name] = arg.type.toString();
          return acum;
        }, {} as Record<string, string>);
      }

      return interfaceValue;
    });
    interfacesMap.set(type.name, list);
  };

  config.types.forEach((type) => {
    if (
      type.name.startsWith('__') ||
      type === queryType ||
      type === mutationType ||
      type === subscriptionType
    )
      return;

    /* istanbul ignore else */
    if (type instanceof GraphQLScalarType) {
      parseScalarType(type);
    } else if (type instanceof GraphQLObjectType) {
      parseObjectType(type);
    } else if (type instanceof GraphQLInterfaceType) {
      parseInterfaceType(type);
    } else if (type instanceof GraphQLUnionType) {
      parseUnionType(type);
    } else if (type instanceof GraphQLEnumType) {
      parseEnumType(type);
    } else if (type instanceof GraphQLInputObjectType) {
      parseInputType(type);
    }
  });

  /* istanbul ignore else */
  if (queryType) {
    parseObjectType(queryType, 'query');
  }

  if (mutationType) {
    parseObjectType(mutationType, 'mutation');
  }

  if (subscriptionType) {
    parseObjectType(subscriptionType, 'subscription');
  }

  const unionsMapObj = Object.fromEntries(unionsMap);
  if (unionsMap.size) {
    generatedSchema[SchemaUnionsKey] = unionsMapObj;
  }

  function parseFinalType({
    pureType,
    isArray,
    nullableItems,
    isNullable,
  }: ReturnType<typeof parseSchemaType>) {
    let typeToReturn: string[] = [
      scalarsEnumsHash[pureType] ? `ScalarsEnums["${pureType}"]` : pureType,
    ];

    if (isArray) {
      typeToReturn = [
        'Array<',
        ...(nullableItems ? ['Maybe<', ...typeToReturn, '>'] : typeToReturn),
        '>',
      ];
    }

    if (isNullable) {
      typeToReturn = ['Maybe<', ...typeToReturn, '>'];
    }

    return typeToReturn.join('');
  }

  const objectTypeTSTypes = new Map<string, Map<string, string>>();

  let typescriptTypes = Object.entries(generatedSchema).reduce(
    (acum, [typeKey, typeValue]) => {
      const typeName = (() => {
        switch (typeKey) {
          case 'query': {
            return 'Query';
          }
          case 'mutation': {
            return 'Mutation';
          }
          case 'subscription': {
            return 'Subscription';
          }
          default: {
            return typeKey;
          }
        }
      })();

      if (inputTypeNames.has(typeName)) return acum;

      const objectTypeMap = new Map<string, string>();
      objectTypeTSTypes.set(typeName, objectTypeMap);

      const objectTypeInterfaces = objectTypeInterfacesMap.get(typeName);

      acum += `

      export interface ${typeName} ${
        objectTypeInterfaces ? 'extends ' + objectTypeInterfaces.join(', ') : ''
      }{ 
        __typename: "${typeName}" | null; ${Object.entries(typeValue).reduce(
        (acum, [fieldKey, fieldValue]) => {
          if (fieldKey === '__typename') {
            objectTypeMap.set(fieldKey, `: "${typeName}" | null`);
            return acum;
          }

          const fieldValueProps = parseSchemaType(fieldValue.__type);
          const typeToReturn = parseFinalType(fieldValueProps);
          let finalType: string;
          if (fieldValue.__args) {
            const argsEntries = Object.entries(fieldValue.__args);
            let onlyNullableArgs = true;
            const argTypes = argsEntries.reduce(
              (acum, [argKey, argValue], index) => {
                const argValueProps = parseSchemaType(argValue);
                const connector = argValueProps.isNullable ? '?:' : ':';

                if (!argValueProps.isNullable) {
                  onlyNullableArgs = false;
                }

                const argTypeValue = parseFinalType(argValueProps);

                acum += `${argKey}${connector} ${argTypeValue}`;
                if (index < argsEntries.length - 1) {
                  acum += '; ';
                }
                return acum;
              },
              ''
            );
            const argsConnector = onlyNullableArgs ? '?:' : ':';
            finalType = `: (args${argsConnector} {${argTypes}}) => ${typeToReturn}`;
          } else {
            const connector = fieldValueProps.isNullable ? '?:' : ':';
            finalType = `${connector} ${typeToReturn}`;
          }

          objectTypeMap.set(fieldKey, finalType);

          acum += '\n' + fieldKey + finalType;

          return acum;
        },
        ''
      )}
      }
      `;

      return acum;
    },
    ''
  );

  if (unionsMap.size) {
    typescriptTypes += `
    ${Array.from(unionsMap.entries()).reduce((acum, [unionName, types]) => {
      const allUnionFields = new Set<string>();
      types.forEach((typeName) => {
        const typeMap = objectTypeTSTypes.get(typeName);
        /* istanbul ignore else */
        if (typeMap) {
          typeMap.forEach((_value, fieldName) => allUnionFields.add(fieldName));
        }
      });
      const allUnionFieldsArray = Array.from(allUnionFields).sort();

      acum += `export type ${unionName} = ${
        types
          .reduce((acumTypes, typeName) => {
            const typeMap = objectTypeTSTypes.get(typeName);

            /* istanbul ignore else */
            if (typeMap) {
              acumTypes.push(
                `{ ${allUnionFieldsArray
                  .map((fieldName) => {
                    const foundType = typeMap.get(fieldName);

                    return `${fieldName}${foundType || '?: undefined'};`;
                  })
                  .join('')} }`
              );
            }
            return acumTypes;
          }, [] as string[])
          .join(' | ') /* istanbul ignore next */ || '{}'
      };`;

      return acum;
    }, '')}
    `;
  }

  if (interfacesMap.size) {
    typescriptTypes += `
    ${Array.from(interfacesMap.entries()).reduce(
      (acum, [interfaceName, fields]) => {
        acum += `export interface ${interfaceName} {
        ${fields.reduce((fieldAcum, { __type, fieldName, __args }) => {
          const fieldValueProps = parseSchemaType(__type);
          const typeToReturn = parseFinalType(fieldValueProps);

          if (__args) {
            const argsEntries = Object.entries(__args);
            let onlyNullableArgs = true;
            const argTypes = argsEntries.reduce(
              (acum, [argKey, argValue], index) => {
                const argValueProps = parseSchemaType(argValue);
                const connector = argValueProps.isNullable ? '?:' : ':';

                if (!argValueProps.isNullable) {
                  onlyNullableArgs = false;
                }

                const argTypeValue = parseFinalType(argValueProps);

                acum += `${argKey}${connector} ${argTypeValue}`;
                if (index < argsEntries.length - 1) {
                  acum += '; ';
                }
                return acum;
              },
              ''
            );
            const argsConnector = onlyNullableArgs ? '?:' : ':';
            acum += `
            ${fieldName}: (args${argsConnector} {${argTypes}}) => ${typeToReturn}`;
          } else {
            const connector = fieldValueProps.isNullable ? '?:' : ':';
            fieldAcum += `
            ${fieldName}${connector} ${typeToReturn}`;
          }

          return fieldAcum;
        }, '')}
      }`;
        return acum;
      },
      ''
    )}
    `;
  }

  typescriptTypes += `
    export interface GeneratedSchema {
      query: Query
      mutation: Mutation
      subscription: Subscription
    }
    `;

  typescriptTypes += `
    export type MakeNullable<T> = {
      [K in keyof T]: T[K] | null;
    };
  
    export interface ScalarsEnums extends MakeNullable<Scalars> {
      ${enumsNames.reduce((acum, enumName) => {
        acum += `${enumName}: ${enumName} | null;`;
        return acum;
      }, '')}
    }
    `;

  const queryFetcher = `
    const queryFetcher : QueryFetcher = async function (query, variables) {
        const response = await fetch("/graphql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query,
            variables,
          }),
          mode: "cors",
        });
      
        if (!response.ok) {
          throw new Error(\`Network error, received status code \${response.status}\`);
        }
      
        const json = await response.json();
      
        return json;
      };
    `;

  const [codegenResult, formatConfig] = await Promise.all([
    codegenResultPromise,
    prettierConfigPromise,
  ]);

  const schemaCode = format(
    `
  ${preImport}

  import { ScalarsEnumsHash, SchemaUnionsKey } from "@dish/gqless";

  ${codegenResult}

  export const scalarsEnumsHash: ScalarsEnumsHash = ${JSON.stringify(
    scalarsEnumsHash
  )};
  export const generatedSchema = {${Object.entries(generatedSchema).reduceRight(
    (acum, [key, value]) => {
      return `${JSON.stringify(key)}:${JSON.stringify(value)}, ${acum}`;
    },
    unionsMap.size ? `[SchemaUnionsKey]: ${JSON.stringify(unionsMapObj)}` : ''
  )}} as const;

  ${typescriptTypes}
    `,
    formatConfig
  );

  const clientCode = format(
    `
  import { createClient, QueryFetcher } from "@dish/gqless";
  import { GeneratedSchema, generatedSchema, scalarsEnumsHash } from "./schema.generated";

  ${queryFetcher}

  export const client = createClient<GeneratedSchema>({ schema: generatedSchema, scalarsEnumsHash, queryFetcher});

  export const { query, mutation, mutate, subscription, resolved, refetch } = client;

  export * from "./schema.generated";
  `,
    formatConfig
  );
  return {
    clientCode,
    schemaCode,
    generatedSchema,
    scalarsEnumsHash,
  };
}
