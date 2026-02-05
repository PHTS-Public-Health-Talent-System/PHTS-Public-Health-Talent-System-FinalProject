/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // บังคับใช้ CommonJS สำหรับการ Test เพื่อแก้ปัญหา "Cannot use import statement"
        tsconfig: {
          module: 'commonjs',
          esModuleInterop: true,
        },
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/(.*)\\.js$': '<rootDir>/src/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@config/(.*)\\.js$': '<rootDir>/src/config/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@middlewares/(.*)\\.js$': '<rootDir>/src/middlewares/$1',
    '^@middlewares/(.*)$': '<rootDir>/src/middlewares/$1',
    '^@types/(.*)\\.js$': '<rootDir>/src/types/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@shared/(.*)\\.js$': '<rootDir>/src/shared/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@scripts/(.*)\\.js$': '<rootDir>/src/scripts/$1',
    '^@scripts/(.*)$': '<rootDir>/src/scripts/$1',
    '^@validators/(.*)\\.js$': '<rootDir>/src/validators/$1',
    '^@validators/(.*)$': '<rootDir>/src/validators/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^file-type$': '<rootDir>/src/__mocks__/file-type.ts',
  },
  // Only pick files named *.test.* or *.spec.* (ignore helpers like utils.ts)
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  // Run sequentially to prevent DB clashes between suites
  maxWorkers: 1,
  // Force exit to avoid lingering open handles from Express/MySQL in integration runs
  forceExit: true,
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
};
