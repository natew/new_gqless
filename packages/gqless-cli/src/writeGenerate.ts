import { writeFile } from 'fs/promises';
import { GraphQLSchema } from 'graphql';
import mkdirp from 'mkdirp';
import { dirname, resolve } from 'path';

import { generate, GenerateOptions } from './generate';

export async function writeGenerate(
  schema: GraphQLSchema,
  destinationPath: string,
  generateOptions?: GenerateOptions
) {
  destinationPath = resolve(destinationPath);
  const { code } = await generate(schema, generateOptions);

  await mkdirp(dirname(destinationPath));

  await writeFile(destinationPath, code, {
    encoding: 'utf-8',
  });

  return destinationPath;
}
