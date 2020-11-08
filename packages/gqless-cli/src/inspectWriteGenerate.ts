import { existsSync } from 'fs';
import { resolve } from 'path';

import { GenerateOptions } from './generate';
import { getRemoteSchema } from './introspection';
import { writeGenerate } from './writeGenerate';

export async function inspectWriteGenerate({
  endpoint,
  overwrite,
  destination = './src/generated/index.ts',
  generateOptions,
  cli,
  headers,
}: {
  /**
   * GraphQL API endpoint
   *
   * @example 'http://localhost:3000/graphql'
   */
  endpoint: string;
  /**
   * Whether the generation should overwrite if file already exists
   */
  overwrite?: boolean;
  /**
   * File path destination
   * @default './src/generated/index.ts'
   */
  destination?: string;
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

  const schema = await getRemoteSchema(endpoint, {
    headers,
  });

  if (!overwrite && existsSync(destination)) {
    const err = Error(
      `File '${destination}' already exists, specify ${
        cli ? "'--overwrite'" : "'overwrite: true'"
      } to overwrite the existing file.`
    );

    Error.captureStackTrace(err, inspectWriteGenerate);

    throw err;
  }

  const generatedPath = await writeGenerate(
    schema,
    destination,
    generateOptions
  );

  if (cli) {
    console.log('Code generated successfully at ' + generatedPath);
  }
}
