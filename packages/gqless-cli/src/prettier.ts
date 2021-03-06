import {
  Options as PrettierOptions,
  resolveConfig,
  format as prettierFormat,
} from 'prettier';

const commonConfig = resolveConfig(process.cwd());

export function formatPrettier(
  defaultOptions: Omit<PrettierOptions, 'parser'> &
    Required<Pick<PrettierOptions, 'parser'>>
) {
  const configPromise = commonConfig.then((config) =>
    Object.assign({}, config, defaultOptions)
  );

  return {
    async format(input: string) {
      return prettierFormat(input, await configPromise);
    },
  };
}
