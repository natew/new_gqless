/**
 * @type {import("@jest/types").Config.InitialOptions}
 */
module.exports = {
  globals: {
    'ts-jest': {
      packageJson: 'package.json',
    },
  },
  testPathIgnorePatterns: ['/node_modules/', '/test/generated'],
  collectCoverage: true,
  collectCoverageFrom: ['./src/**/*.ts'],
};
