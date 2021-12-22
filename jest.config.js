 export default {
  testEnvironment: 'node',
  testTimeout: 600000,
  setupFiles: ['./test/post-test-init.js'],
  // modulePathIgnorePatterns: ['/deployments', 'tests/ignored'],
  // globalSetup: './node_modules/@shelf/jest-mongodb/setup.js',
  // globalTeardown: './node_modules/@shelf/jest-mongodb/teardown.js',
};