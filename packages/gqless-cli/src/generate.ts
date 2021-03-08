import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLUnionType,
  parse,
} from 'graphql';

import {
  parseSchemaType,
  ScalarsEnumsHash,
  Schema,
  SchemaUnionsKey,
  Type,
} from '@dish/gqless';
import { codegen } from '@graphql-codegen/core';
import * as typescriptPlugin from '@graphql-codegen/typescript';
import { printSchemaWithDirectives } from '@graphql-tools/utils';

import { gqlessConfigPromise } from './config';
import { formatPrettier } from './prettier';

export interface GenerateOptions {
  /**
   * Target Query Fetcher endpoint
   * @default '/graphql'
   */
  endpoint?: string;
  /**
   * Add a custom string at the beginning of the schema file, for example, add imports.
   */
  preImport?: string;
  /**
   * Specify the types of custom scalars
   */
  scalars?: Record<string, string>;
  /**
   * Generate React Client code
   */
  react?: boolean;
  /**
   * Define enums as string types instead of enums objects
   * @default false
   */
  enumsAsStrings?: boolean;
}

export async function generate(
  schema: GraphQLSchema,
  { preImport, scalars, react, endpoint, enumsAsStrings }: GenerateOptions = {}
): Promise<{
  clientCode: string;
  schemaCode: string;
  generatedSchema: Schema;
  scalarsEnumsHash: ScalarsEnumsHash;
}> {
  const gqlessConfig = (await gqlessConfigPromise).config;
  enumsAsStrings ??= gqlessConfig.enumsAsStrings ?? false;
  scalars ??= gqlessConfig.scalars;
  endpoint ??= gqlessConfig.endpoint ?? '/graphql';
  react ??= gqlessConfig.react ?? false;
  preImport ??= gqlessConfig.preImport ?? '';

  const { format } = formatPrettier({
    parser: 'typescript',
  });

  const codegenResultPromise = codegen({
    schema: parse(printSchemaWithDirectives(schema)),
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
          enumsAsTypes: enumsAsStrings,
        } as typescriptPlugin.TypeScriptPluginConfig,
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

  const descriptions = new Map<string, string>();

  interface FieldDescription {
    description?: string | null;
    deprecated?: string | null;
    defaultValue?: string | null;
  }

  const fieldsDescriptions = new Map<
    string,
    Record<string, FieldDescription | undefined>
  >();

  type ArgsDescriptions = Record<
    string,
    Record<string, FieldDescription | undefined>
  >;

  const fieldsArgsDescriptions = new Map<string, ArgsDescriptions>();

  function addDescription(
    typeName: string | [parent: string, field: string, arg?: string]
  ) {
    if (Array.isArray(typeName)) {
      const data = typeName[2]
        ? /* istanbul ignore next */
          fieldsArgsDescriptions.get(typeName[0])?.[typeName[1]]?.[typeName[2]]
        : /* istanbul ignore next */
          fieldsDescriptions.get(typeName[0])?.[typeName[1]];

      let comment = '';

      if (data?.description) {
        comment +=
          '\n' +
          data.description
            .trim()
            .split('\n')
            .map((line) => '* ' + line)
            .join('\n');
      }

      if (data?.deprecated) {
        comment +=
          '\n* @deprecated ' +
          data.deprecated.trim().replace(/\n/g, '. ').trim();
      }

      if (data?.defaultValue) {
        comment += '\n* @defaultValue ' + '`' + data.defaultValue.trim() + '`';
      }

      return comment
        ? `/** ${comment} 
      */\n`
        : '';
    } else {
      const desc = descriptions.get(typeName);
      return desc
        ? `/**
        ${desc
          .trim()
          .split('\n')
          .map((line) => '* ' + line)
          .join('\n')}
      */\n`
        : '';
    }
  }

  const parseEnumType = (type: GraphQLEnumType) => {
    scalarsEnumsHash[type.name] = true;
    enumsNames.push(type.name);

    const values = type.getValues();

    const enumValuesDescriptions: Record<string, FieldDescription> = {};

    for (const value of values) {
      if (value.isDeprecated || value.description) {
        enumValuesDescriptions[value.name] = {
          description: value.description,
          deprecated: value.isDeprecated ? value.deprecationReason : undefined,
        };
      }
    }

    fieldsDescriptions.set(type.name, enumValuesDescriptions);
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

    const objectFieldsDescriptions: Record<string, FieldDescription> = {};

    const objectFieldsArgsDescriptions: ArgsDescriptions = {};

    Object.entries(fields).forEach(([fieldName, gqlType]) => {
      if (gqlType.description || gqlType.isDeprecated) {
        objectFieldsDescriptions[fieldName] = {
          description: gqlType.description,
          deprecated: gqlType.isDeprecated ? gqlType.deprecationReason : null,
        };
      }

      schemaType[fieldName] = {
        __type: gqlType.type.toString(),
      };

      if (gqlType.args.length) {
        objectFieldsArgsDescriptions[fieldName] ||= {};
        schemaType[fieldName].__args = gqlType.args.reduce((acum, arg) => {
          acum[arg.name] = arg.type.toString();
          if (
            arg.description ||
            arg.deprecationReason ||
            arg.defaultValue != null
          ) {
            objectFieldsArgsDescriptions[fieldName][arg.name] = {
              defaultValue:
                arg.defaultValue != null
                  ? JSON.stringify(arg.defaultValue)
                  : null,
              deprecated: arg.deprecationReason,
              description: arg.description,
            };
          }
          return acum;
        }, {} as Record<string, string>);
      }
    });

    fieldsDescriptions.set(type.name, objectFieldsDescriptions);
    fieldsArgsDescriptions.set(type.name, objectFieldsArgsDescriptions);

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

    const inputFieldDescriptions: Record<string, FieldDescription> = {};

    Object.entries(fields).forEach(([key, value]) => {
      schemaType[key] = {
        __type: value.type.toString(),
      };
      if (value.description || value.deprecationReason || value.defaultValue) {
        inputFieldDescriptions[key] = {
          description: value.description,
          deprecated: value.deprecationReason,
          defaultValue:
            value.defaultValue != null
              ? JSON.stringify(value.defaultValue)
              : null,
        };
      }
    });

    generatedSchema[type.name] = schemaType;
  };

  type InterfaceMapValue = {
    fieldName: string;
  } & Type;
  const interfacesMap = new Map<string, InterfaceMapValue[]>();

  const parseInterfaceType = (type: GraphQLInterfaceType) => {
    const fields = type.getFields();

    const interfaceFieldDescriptions: Record<string, FieldDescription> = {};

    const objectFieldsArgsDescriptions: ArgsDescriptions = {};

    const list = Object.entries(fields).map(([fieldName, gqlType]) => {
      const interfaceValue: InterfaceMapValue = {
        fieldName,
        __type: gqlType.type.toString(),
      };

      if (gqlType.args.length) {
        objectFieldsArgsDescriptions[fieldName] ||= {};
        interfaceValue.__args = gqlType.args.reduce((acum, arg) => {
          acum[arg.name] = arg.type.toString();
          if (
            arg.description ||
            arg.deprecationReason ||
            arg.defaultValue != null
          ) {
            objectFieldsArgsDescriptions[fieldName][arg.name] = {
              defaultValue:
                arg.defaultValue != null
                  ? JSON.stringify(arg.defaultValue)
                  : null,
              deprecated: arg.deprecationReason,
              description: arg.description,
            };
          }
          return acum;
        }, {} as Record<string, string>);
      }

      if (gqlType.description || gqlType.isDeprecated) {
        interfaceFieldDescriptions[fieldName] = {
          description: gqlType.description,
          deprecated: gqlType.isDeprecated ? gqlType.deprecationReason : null,
        };
      }

      return interfaceValue;
    });
    fieldsDescriptions.set(type.name, interfaceFieldDescriptions);

    fieldsArgsDescriptions.set(type.name, objectFieldsArgsDescriptions);

    interfacesMap.set(type.name, list);
  };

  config.types.forEach((type) => {
    if (type.description) {
      descriptions.set(type.name, type.description);
    }
    if (
      type.name.startsWith('__') ||
      type === queryType ||
      type === mutationType ||
      type === subscriptionType
    ) {
      return;
    }

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

    if (isNullable && !scalarsEnumsHash[pureType]) {
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

      ${addDescription(typeName)}export interface ${typeName} ${
        objectTypeInterfaces ? 'extends ' + objectTypeInterfaces.join(', ') : ''
      }{ 
        __typename: "${typeName}" | undefined; ${Object.entries(
        typeValue
      ).reduce((acum, [fieldKey, fieldValue]) => {
        if (fieldKey === '__typename') {
          objectTypeMap.set(fieldKey, `: "${typeName}" | undefined`);
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

              acum += `${addDescription([
                typeName,
                fieldKey,
                argKey,
              ])}${argKey}${connector} ${argTypeValue}`;
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

        acum +=
          '\n' + addDescription([typeName, fieldKey]) + fieldKey + finalType;

        return acum;
      }, '')}
      }
      `;

      return acum;
    },
    ''
  );

  const objectTypesEntries = Array.from(objectTypeTSTypes.entries());

  typescriptTypes += `
  export interface SchemaObjectTypes {
    ${objectTypesEntries.reduce((acum, [typeName]) => {
      acum += `${typeName}:${typeName};`;
      return acum;
    }, '')}
  }
  export type SchemaObjectTypesNames = ${objectTypesEntries
    .map(([key]) => `"${key}"`)
    .join(' | ')};
  `;

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

      acum += `${addDescription(unionName)}export type ${unionName} = ${
        types
          .reduce((acumTypes, typeName) => {
            const typeMap = objectTypeTSTypes.get(typeName);

            /* istanbul ignore else */
            if (typeMap) {
              acumTypes.push(
                `{ ${allUnionFieldsArray
                  .map((fieldName) => {
                    const foundType = typeMap.get(fieldName);

                    return `${addDescription([
                      typeName,
                      fieldName,
                    ])}${fieldName}${foundType || '?: undefined'};`;
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
        acum += `${addDescription(
          interfaceName
        )}export interface ${interfaceName} {
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
            ${addDescription([
              interfaceName,
              fieldName,
            ])}${fieldName}: (args${argsConnector} {${argTypes}}) => ${typeToReturn}`;
          } else {
            const connector = fieldValueProps.isNullable ? '?:' : ':';
            fieldAcum += `
            ${addDescription([
              interfaceName,
              fieldName,
            ])}${fieldName}${connector} ${typeToReturn}`;
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
      [K in keyof T]: T[K] | undefined;
    };
  
    export interface ScalarsEnums extends MakeNullable<Scalars> {
      ${enumsNames.reduce((acum, enumName) => {
        acum += `${enumName}: ${enumName} | undefined;`;
        return acum;
      }, '')}
    }
    `;

  const queryFetcher = `
    const queryFetcher : QueryFetcher = async function (query, variables) {
        // Modify "${endpoint}" if needed
        const response = await fetch("${endpoint}", {
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

  const hasUnions = !!unionsMap.size;

  const schemaCode = await format(
    `
/**
 * GQLESS AUTO-GENERATED CODE: PLEASE DO NOT MODIFY MANUALLY
 */
  ${preImport}

  import { ScalarsEnumsHash${
    hasUnions ? ', SchemaUnionsKey' : ''
  } } from "@dish/gqless";

  ${await codegenResultPromise}

  export const scalarsEnumsHash: ScalarsEnumsHash = ${JSON.stringify(
    scalarsEnumsHash
  )};
  export const generatedSchema = {${Object.entries(generatedSchema).reduceRight(
    (acum, [key, value]) => {
      return `${JSON.stringify(key)}:${JSON.stringify(value)}, ${acum}`;
    },
    hasUnions ? `[SchemaUnionsKey]: ${JSON.stringify(unionsMapObj)}` : ''
  )}} as const;

  ${typescriptTypes}
    `
  );

  const clientCode = await format(
    `
/**
 * GQLESS: You can safely modify this file and Query Fetcher based on your needs
 */

  ${react ? `import { createReactClient } from "@dish/gqless-react"` : ''}
  import { createClient, QueryFetcher } from "@dish/gqless";
  import { GeneratedSchema, generatedSchema, scalarsEnumsHash, SchemaObjectTypes, SchemaObjectTypesNames } from "./schema.generated";

  ${queryFetcher}

  export const client = createClient<GeneratedSchema, SchemaObjectTypesNames, SchemaObjectTypes>({ schema: generatedSchema, scalarsEnumsHash, queryFetcher });

  export const { query, mutation, mutate, subscription, resolved, refetch } = client;

  ${
    react
      ? `export const {
    graphql,
    useQuery,
    useTransactionQuery,
    useLazyQuery,
    usePolling,
    useMutation,
    useRefetch,
    useMetaState    
  } = createReactClient<GeneratedSchema>(client, {
    defaults: {
      // Set this flag as "false" if your usage doesn't involve React Suspense
      suspense: true,

      // Set this Policy based on your needs
      fetchPolicy: "cache-first",

      // Set this flag based on your needs
      staleWhileRevalidate: false
    }
  });`
      : ''
  }

  export * from "./schema.generated";
  `
  );
  return {
    clientCode,
    schemaCode,
    generatedSchema,
    scalarsEnumsHash,
  };
}
