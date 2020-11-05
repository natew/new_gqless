import { GenerateOptions } from 'gqless-cli/src/generate';
import { getRemoteSchema } from './introspection';
import { writeGenerate } from './writeGenerate';
import { existsSync } from 'fs';
import { resolve } from 'path';

export async function inspectWriteGenerate({
  endpoint,
  overwrite,
  destination = './graphql/generated/index.ts',
  generateOptions,
  cli,
}: {
  endpoint: string;
  overwrite?: boolean;
  destination?: string;
  generateOptions?: GenerateOptions;
  cli?: boolean;
}) {
  destination = resolve(destination);
  const schema = await getRemoteSchema(endpoint);

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
