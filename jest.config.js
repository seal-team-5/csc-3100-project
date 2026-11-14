export default {
    testEnvironment: 'node',
    testMatch: ['<rootDir>/packages/server/ta7/**/*.test.js'],
  
    extensionsToTreatAsEsm: ['.ts'],
  
    transform: {
      '^.+\\.ts$': [
        '@swc/jest',
        {
          jsc: {
            parser: {
              syntax: 'typescript',
            },
            target: 'es2022',
          },
          module: {
            type: 'es6',
          },
        },
      ],
    },
  };