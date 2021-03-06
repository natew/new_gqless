import { cosmiconfig } from 'cosmiconfig';
import { promises } from 'fs';
import { resolve } from 'path';
import { Boolean, Partial, Static, String, Unknown } from 'runtypes';

import { GenerateOptions } from './generate';

export type gqlessConfig = Static<
  typeof gqlessCLIConfigRecord
> extends GenerateOptions
  ? GenerateOptions extends Static<typeof gqlessCLIConfigRecord>
    ? GenerateOptions
    : never
  : never;

const gqlessCLIConfigRecord = Partial({
  endpoint: String,
  enumsAsStrings: Boolean,
  scalars: Unknown.withConstraint<Record<string, string>>((scalars) => {
    return (
      typeof scalars === 'object' &&
      scalars != null &&
      !Array.isArray(scalars) &&
      Object.values(scalars).every((v) => typeof v === 'string')
    );
  }),
  react: Boolean,
  preImport: String,
});

export const defaultConfig: gqlessConfig = gqlessCLIConfigRecord.check({
  endpoint: '/graphql',
  enumsAsStrings: false,
  react: false,
  scalars: {
    DateTime: 'string',
  },
  preImport: '',
} as gqlessConfig);

export const gqlessConfigPromise: Promise<gqlessConfig> = cosmiconfig(
  'gqless',
  {}
)
  .search()
  .then(async (config) => {
    if (!config || config.isEmpty) {
      if (
        process.env.NODE_ENV !== 'test' &&
        process.env.NODE_ENV !== 'production'
      ) {
        const { format } = (await import('./prettier')).formatPrettier({
          parser: 'typescript',
        });
        await promises.writeFile(
          resolve(process.cwd(), 'gqless.config.js'),
          await format(`
          /**
           * @type {import("@dish/gqless-cli").gqlessConfig}
           */
          const config = ${JSON.stringify(defaultConfig)};
          
          module.exports = config;`)
        );
      }
      return defaultConfig;
    }
    return gqlessCLIConfigRecord.check(config.config);
  })
  .catch(() => defaultConfig);
