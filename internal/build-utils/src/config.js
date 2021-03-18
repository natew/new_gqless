import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { terser } from 'rollup-plugin-terser';
import replace from '@rollup/plugin-replace';
import typescript from '@rollup/plugin-typescript';
import cleanup from 'rollup-plugin-cleanup';
import { getBabelOutputPlugin } from '@rollup/plugin-babel';

function outputReplace(
  /**
   * @type {import("@rollup/plugin-replace").RollupReplaceOptions}
   */
  options
) {
  const { buildStart, transform, ...rest } = replace({
    ...options,
    preventAssignment: true,
  });

  return rest;
}

const babelPlugin = getBabelOutputPlugin({
  babelrc: false,
  plugins: [
    '@babel/plugin-proposal-optional-chaining',
    '@babel/plugin-proposal-nullish-coalescing-operator',
  ],
  //@ts-expect-error
  assumptions: {
    noDocumentAll: true,
  },
});

export function getOutputOptions(
  /**
   * @type {string}
   */
  moduleName
) {
  /**
   * @type {import("rollup").OutputOptions[]}
   */
  const outputOptions = [
    {
      file: `dist/${moduleName}.cjs.development.js`,
      format: 'cjs',
      sourcemap: true,
      preferConst: true,
      exports: 'named',
      plugins: [babelPlugin],
    },
    {
      file: `dist/${moduleName}.cjs.production.min.js`,
      format: 'cjs',
      sourcemap: true,
      preferConst: true,
      exports: 'named',
      plugins: [
        outputReplace({
          values: {
            'process.env.NODE_ENV': '"production"',
          },
        }),
        babelPlugin,
        terser(),
      ],
    },
    {
      file: `dist/${moduleName}.esm.js`,
      format: 'esm',
      sourcemap: true,
      preferConst: true,
      plugins: [
        outputReplace({
          values: {
            'lodash/': 'lodash-es/',
          },
        }),
        babelPlugin,
      ],
      exports: 'named',
    },
  ];

  return {
    outputOptions,
    async write(
      /**
       * @type {import("rollup").RollupBuild}
       */
      bundle,
      afterFileWrite = () => {}
    ) {
      await Promise.all(
        outputOptions.map((output) => bundle.write(output).then(afterFileWrite))
      );
    },
  };
}

export function getInputOptions() {
  let input = 'src/index.ts';

  if (existsSync('src/index.tsx')) {
    input = 'src/index.tsx';
  }

  const { dependencies, peerDependencies } = JSON.parse(
    readFileSync(resolve(process.cwd(), './package.json'), {
      encoding: 'utf8',
    })
  );
  /**
   * @type {import("rollup").InputOptions}
   */
  const inputOptions = {
    input,
    plugins: [
      typescript({
        incremental: false,
        tsBuildInfoFile: undefined,
        declaration: true,
        outDir: 'dist',
        noEmitOnError: true,
        target: 'es2020',
      }),
      cleanup({
        comments: 'none',
        extensions: ['js', 'mjs', 'ts', 'tsx'],
      }),
    ],
    external: [
      /lodash.*/g,
      'fs',
      'path',
      /prettier\/.+/g,
      ...Object.keys(dependencies || {}),
      ...Object.keys(peerDependencies || {}),
    ],
    onwarn(warning, next) {
      if (warning.code === 'EVAL') return;

      next(warning);
    },
    treeshake: {
      propertyReadSideEffects: false,
    },
  };

  return inputOptions;
}
