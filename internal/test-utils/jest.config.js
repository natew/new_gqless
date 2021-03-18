/**
 * @type {import("@jest/types").Config.InitialOptions}
 */
const defaultConfig = {
  globals: {
    'ts-jest': {},
  },
  transform: {
    '.(ts|tsx)$': require.resolve('ts-jest/dist'),
  },
  transformIgnorePatterns: ['[/\\\\]node_modules[/\\\\].+\\.(js|jsx)$'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts', '**/test/**/*.test.tsx'],
  testURL: 'http://localhost',
  testPathIgnorePatterns: ['/node_modules/', '/test/generated'],
  collectCoverage: true,
  collectCoverageFrom: ['./src/**/*.ts', './src/**/*.tsx', '!**/*.d.ts'],
  testTimeout: 10000,
  watchPlugins: [
    require.resolve('jest-watch-typeahead/filename'),
    require.resolve('jest-watch-typeahead/testname'),
  ],
};

exports.getConfig = function getConfig(
  /**
   * @type {import("ts-jest")}
   * @type {import("@jest/types").Config.InitialOptions}
   */
  config = {}
) {
  /**
   * @type {import("@jest/types").Config.InitialOptions}
   */
  const newConfig = {
    ...defaultConfig,
    ...config,
  };

  return newConfig;
};

module.exports = defaultConfig;
