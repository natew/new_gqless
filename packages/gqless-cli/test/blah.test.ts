import { parseSchemaType, Schema, Type } from 'gqless';
import {
  GraphQLEnumType,
  GraphQLObjectType,
  GraphQLScalarType,
  printSchema,
  parse,
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

    const scalarsHash: Record<string, true> = {};

    const generatedSchema: Schema = {
      query: {},
    };

    config.types.map((type) => {
      if (type.toString().startsWith('__')) return;
      if (type.name === 'Query') type.name = 'query';

      if (
        type instanceof GraphQLScalarType ||
        type instanceof GraphQLEnumType
      ) {
        scalarsHash[type.name] = true;
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
      }
    });

    function parseFinalType({
      pureType,
      isArray,
      nullableItems,
      isNullable,
    }: ReturnType<typeof parseSchemaType>) {
      let typeToReturn: string[] = [
        scalarsHash[pureType] ? `Scalars["${pureType}"]` : pureType,
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

    typescriptTypes += `export interface GeneratedSchema {
      query: Query
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
          },
        },
      ],
    });

    console.log(
      format(
        `
      const scalarHash = ${JSON.stringify(scalarsHash)};
      const generatedSchema = ${JSON.stringify(
        generatedSchema,
        null,
        2
      )} as const;

      ${typescriptTypes}

      ${codegenResult}
      `,
        {
          parser: 'typescript',
          ...(await resolveConfig(process.cwd())),
        }
      )
    );
  });
});
