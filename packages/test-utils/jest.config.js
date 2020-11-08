module.exports = {
  globals: {
    'ts-jest': {
      packageJson: 'package.json',
    },
  },
  testPathIgnorePatterns: ['/node_modules/', '/test/generated'],
};
