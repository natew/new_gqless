import { parseSchemaType, ScalarsEnumsHash, Schema, Type } from '@dish/gqless';
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
import { format, resolveConfig } from 'prettier';

import { codegen } from '@graphql-codegen/core';
import * as typescriptPlugin from '@graphql-codegen/typescript';

export type GenerateOptions = {
  /**
   * Overwrite the default 'queryFetcher'
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
  const prettierConfig = resolveConfig(process.cwd()).then((conf) => {
    return conf || {};
  });
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
  };

  config.types.map((type) => {
    if (type.toString().startsWith('__')) return;
    if (type.name === 'Query') type.name = 'query';

    if (type instanceof GraphQLEnumType) {
      scalarsEnumsHash[type.name] = true;
      enumsNames.push(type.name);
    } else if (type instanceof GraphQLScalarType) {
      scalarsEnumsHash[type.name] = true;
    } else if (type instanceof GraphQLObjectType) {
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

      generatedSchema[type.name] = schemaType;
    } else if (type instanceof GraphQLInputObjectType) {
      inputTypeNames.add(type.name);
      const fields = type.getFields();

      const schemaType: Record<string, Type> = {};

      Object.entries(fields).forEach(([key, value]) => {
        schemaType[key] = {
          __type: value.type.toString(),
        };
      });

      generatedSchema[type.name] = schemaType;
    }
  });

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
        if (typeKey === 'query') {
          return 'Query';
        }
        return typeKey;
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
  import { createClient, QueryFetcher, ScalarsEnumsHash, Schema } from "@dish/gqless";

  ${await codegenResult}

  const scalarsEnumsHash: ScalarsEnumsHash = ${JSON.stringify(
    scalarsEnumsHash
  )};
  const generatedSchema: Schema = ${JSON.stringify(generatedSchema)};

  ${typescriptTypes}

  ${queryFetcher}

  export const { client, resolveAllSelections, resolved } = createClient<GeneratedSchema>(generatedSchema, scalarsEnumsHash, queryFetcher)
  `,
    {
      ...(await prettierConfig),
      parser: 'typescript',
    }
  );

  return {
    code,
    generatedSchema,
    scalarsEnumsHash,
  };
}
