import { parseSchemaType, Schema, Type } from 'gqless';
import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLObjectType,
  GraphQLScalarType,
  parse,
  printSchema,
} from 'graphql';
import { fromPairs } from 'lodash';
import { app } from 'mercurius-example';
import { format, resolveConfig } from 'prettier';

import { codegen } from '@graphql-codegen/core';
import * as typescriptPlugin from '@graphql-codegen/typescript';

import { getRemoteSchema } from '../src';

let endpoint: string;
beforeAll(async () => {
  const listenAddress = await app.listen(0);

  endpoint = listenAddress + '/graphql';
});

afterAll(async () => {
  await app.close();
});

describe('works', () => {
  it('works', async () => {
    const schema = await getRemoteSchema(endpoint);

    schema.getQueryType();

    const config = schema.toConfig();

    const scalarsEnumsHash: Record<string, true> = {};

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
        acum += `${enumName}: ${enumName}`;
        return acum;
      }, '')}
    }
    `;

    const codegenResult = await codegen({
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
          },
        },
      ],
    });

    console.log(
      format(
        `
      import { createClient, QueryFetcher, ScalarsEnumsHash, Schema } from "gqless";

      ${codegenResult}

      const scalarsEnumsHash: ScalarsEnumsHash = ${JSON.stringify(
        scalarsEnumsHash
      )};
      const generatedSchema: Schema = ${JSON.stringify(generatedSchema)};

      ${typescriptTypes}

      const queryFetcher: QueryFetcher = async function (query, variables) {
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
      

      export const { client, resolveAllSelections, resolved } = createClient<GeneratedSchema>(generatedSchema, scalarsEnumsHash, queryFetcher)
      `,
        {
          parser: 'typescript',
          ...(await resolveConfig(process.cwd())),
        }
      )
    );
  });
});
