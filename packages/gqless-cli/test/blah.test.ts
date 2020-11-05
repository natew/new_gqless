import { Schema, Type } from 'gqless';
import { GraphQLEnumType, GraphQLObjectType, GraphQLScalarType } from 'graphql';
import { fromPairs } from 'lodash';

import { getRemoteSchema } from '../src';

describe('works', () => {
  it('works', async () => {
    const schema = await getRemoteSchema();

    schema.getQueryType();

    const config = schema.toConfig();

    const scalarsHash: Record<string, true> = {};

    const generatedSchema: Schema = {
      query: {},
    };

    config.types.map((type) => {
      if (type.name === 'Query') type.name = 'query';
      if (type.toString().startsWith('__')) return;
      if (
        type instanceof GraphQLScalarType ||
        type instanceof GraphQLEnumType
      ) {
        scalarsHash[type.name] = true;
      } else {
        if (type instanceof GraphQLObjectType) {
          const fields = type.getFields();

          const schemaType: Record<string, Type> = {};

          Object.entries(fields).map(([key, value]) => {
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
      }
    });

    console.log(scalarsHash, JSON.stringify(generatedSchema, null, 2));
  });
});
