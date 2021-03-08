import { existsSync } from 'fs';
import { GraphQLSchema, buildSchema } from 'graphql';
import { resolve } from 'path';
import { promises } from 'fs';

import type { GenerateOptions } from './generate';
import { defaultConfig } from './config';

export async function inspectWriteGenerate({
  endpoint,
  destination,
  generateOptions,
  cli,
  headers,
}: {
  /**
   * GraphQL API endpoint or GraphQL Schema file
   *
   * @example 'http://localhost:3000/graphql'
   * @example './schema.gql'
   */
  endpoint: string;
  /**
   * File path destination
   * @example './src/generated/graphql.ts'
   */
  destination: string;
  /**
   * Specify generate options
   */
  generateOptions?: GenerateOptions;
  /**
   * Whether it's being called through the CLI
   */
  cli?: boolean;
  /**
   * Specify headers for the introspection HTTP request
   */
  headers?: Record<string, string>;
}) {
  destination = resolve(destination);

  const genOptions = Object.assign({}, generateOptions);

  let schema: GraphQLSchema;

  defaultConfig.introspection.endpoint = endpoint;
  defaultConfig.introspection.headers = headers;

  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    defaultConfig.endpoint = endpoint;

    schema = await (await import('./introspection')).getRemoteSchema(endpoint, {
      headers,
    });
    genOptions.endpoint = endpoint;
  } else {
    if (existsSync(endpoint)) {
      const file = await promises.readFile(endpoint, {
        encoding: 'utf-8',
      });

      schema = buildSchema(file);
    } else {
      throw Error(
        `File "${endpoint}" doesn't exists. If you meant to inspect a GraphQL API, make sure to put http:// or https:// in front of it.`
      );
    }
  }

  const generatedPath = await (await import('./writeGenerate')).writeGenerate(
    schema,
    destination,
    genOptions
  );

  if (cli) {
    console.log('Code generated successfully at ' + generatedPath);
  }
}
