import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  parse,
  printSchema,
} from 'graphql';
import fromPairs from 'lodash/fromPairs';
import { format, Options as PrettierOptions, resolveConfig } from 'prettier';

import { parseSchemaType, ScalarsEnumsHash, Schema, Type } from '@dish/gqless';
import { codegen } from '@graphql-codegen/core';
import * as typescriptPlugin from '@graphql-codegen/typescript';

export type GenerateOptions = {
  /**
   * Overwrite the default 'queryFetcher'
   * 
   * @default
   * const queryFetcher: QueryFetcher = async function (query, variables) {
        const response = await fetch('/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            variables,
          }),
          mode: 'cors',
        });

      if (!response.ok) {
        throw new Error(`Network error, received status code ${response.status}`);
      }

      const json = await response.json();

      return json;
    };
   */
  queryFetcher?: string;
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
  { queryFetcher, preImport = '', scalars }: GenerateOptions = {}
) {
  const prettierConfig = resolveConfig(process.cwd());
  const codegenResult = codegen({
    schema: parse(printSchema(schema)),
    config: {},
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
  const parseObjectType = (type: GraphQLObjectType, typeName = type.name) => {
    const fields = type.getFields();

    const schemaType: Record<string, Type> = {};

    Object.entries(fields).forEach(([key, value]) => {
      schemaType[key] = {
        __type: value.type.toString(),
      };

      if (value.args.length) {
        schemaType[key].__args = fromPairs(
          value.args.map((arg) => {
            return [arg.name, arg.type.toString()];
          })
        );
      }
    });

    generatedSchema[typeName] = schemaType;
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

  config.types.forEach((type) => {
    if (
      type.name.startsWith('__') ||
      type === queryType ||
      type === mutationType ||
      type === subscriptionType
    )
      return;

    if (type instanceof GraphQLEnumType) {
      parseEnumType(type);
    } else if (type instanceof GraphQLScalarType) {
      parseScalarType(type);
    } else if (type instanceof GraphQLObjectType) {
      parseObjectType(type);
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

      acum += `

      export interface ${typeName} {
        ${Object.entries(typeValue).reduce((acum, [fieldKey, fieldValue]) => {
          const fieldValueProps = parseSchemaType(fieldValue.__type);
          const typeToReturn = parseFinalType(fieldValueProps);
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
            const connector = onlyNullableArgs ? '?:' : ':';
            acum += `
            ${fieldKey}: (args${connector} {${argTypes}}) => ${typeToReturn}`;
          } else {
            acum += `
            ${fieldKey}: ${typeToReturn}`;
          }

          return acum;
        }, '')}
      }
      `;

      return acum;
    },
    ''
  );

  typescriptTypes += `
    export interface GeneratedSchema {
      query: Query
      mutation: Mutation
      subscription: Subscription
    }
    `;

  typescriptTypes += `
    export interface ScalarsEnums extends Scalars {
      ${enumsNames.reduce((acum, enumName) => {
        acum += `${enumName}: ${enumName};`;
        return acum;
      }, '')}
    }
    `;

  queryFetcher =
    queryFetcher ||
    `
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

  const code = format(
    `
  ${preImport}
  import { createClient, QueryFetcher, ScalarsEnumsHash } from "@dish/gqless";

  ${await codegenResult}

  const scalarsEnumsHash: ScalarsEnumsHash = ${JSON.stringify(
    scalarsEnumsHash
  )};
  export const generatedSchema = ${JSON.stringify(generatedSchema)} as const;

  ${typescriptTypes}

  ${queryFetcher}

  export const client = createClient<GeneratedSchema>(generatedSchema, scalarsEnumsHash, queryFetcher)

  export const { query, mutation, subscription, resolved, selectFields } = client;
  `,
    Object.assign({}, await prettierConfig, {
      parser: 'typescript',
    } as PrettierOptions)
  );

  return {
    code,
    generatedSchema,
    scalarsEnumsHash,
  };
}
