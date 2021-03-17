import typescript from '@rollup/plugin-typescript';
import replace from '@rollup/plugin-replace';
import { babel } from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';

/**
 * @type {import("rollup").RollupOptions[]}
 */
const config = [
  {
    input: 'src/index.ts',
    cache: false,
    output: {
      dir: 'dist',
      format: 'cjs',
      sourcemap: true,
      preferConst: true,
    },
    plugins: [
      resolve(),
      babel({
        babelHelpers: 'runtime',
        comments: false,
        babelrc: false,
        plugins: [
          [
            '@babel/plugin-proposal-optional-chaining',
            {
              loose: true,
            },
          ],
        ],
        configFile: false,
        assumptions: {
          noDocumentAll: true,
        },
        skipPreflightCheck: true,
        ast: true,
      }),
      typescript({
        incremental: true,
      }),
    ],
    external: [/lodash.*/g],
    onwarn(warning, next) {
      if (warning.code === 'EVAL') return;

      next(warning);
    },
  },
  {
    input: 'src/index.ts',
    cache: false,

    output: {
      file: 'dist/index.mjs',
      format: 'es',
      sourcemap: true,
      preferConst: true,
    },
    plugins: [
      resolve(),
      babel({
        babelHelpers: 'runtime',
        comments: false,
        babelrc: false,
        plugins: [
          [
            '@babel/plugin-proposal-optional-chaining',
            {
              loose: true,
            },
          ],
        ],
        assumptions: {
          noDocumentAll: true,
        },
      }),
      replace({
        values: {
          'lodash/': 'lodash-es/',
        },
        preventAssignment: true,
      }),
      typescript({
        incremental: false,
        tsBuildInfoFile: undefined,
      }),
    ],

    external: [/lodash.*/g],
    onwarn(warning, next) {
      if (warning.code === 'EVAL') return;

      next(warning);
    },
  },
];

export default config;
