/**
 * @type {import("@jest/types").Config.InitialOptions}
 */
module.exports = {
  transform: {
    '^.+\\.tsx?$': [
      '@swc-node/jest',
      {
        sourcemap: 'inline',
        target: 'es2020',
        module: 'commonjs',
      },
    ],
  },
  testMatch: ['**/test/**/*.test.ts', '**/test/**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '/test/generated'],
  collectCoverage: true,
  collectCoverageFrom: ['./src/**/*.ts', './src/**/*.tsx'],
  testTimeout: 10000,
};
