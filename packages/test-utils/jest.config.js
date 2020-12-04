/**
 * @type {import("@jest/types").Config.InitialOptions}
 */
module.exports = {
  globals: {
    'ts-jest': {
      packageJson: 'package.json',
    },
  },
  testMatch: ['**/test/**/*.test.ts', '**/test/**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '/test/generated'],
  collectCoverage: true,
  collectCoverageFrom: ['./src/**/*.ts', './src/**/*.tsx'],
};
