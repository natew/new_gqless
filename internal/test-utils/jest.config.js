/**
 * @type {import("@jest/types").Config.InitialOptions}
 */
module.exports = {
  globals: {
    'ts-jest': {},
  },
  testMatch: ['**/test/**/*.test.ts', '**/test/**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '/test/generated'],
  collectCoverage: true,
  collectCoverageFrom: ['./src/**/*.ts', './src/**/*.tsx'],
  testTimeout: 10000,
};
