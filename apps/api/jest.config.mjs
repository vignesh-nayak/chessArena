/** @type {import('jest').Config} */
export default {
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@chessarena/shared$": "<rootDir>/../../packages/shared/dist/index.js",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module: "ESNext",
          moduleResolution: "bundler",
          esModuleInterop: true,
          strict: true,
          isolatedModules: true,
          target: "ES2022",
          types: ["jest", "node"],
          verbatimModuleSyntax: false,
        },
      },
    ],
  },
  setupFiles: ["<rootDir>/jest.setup.ts"],
  testMatch: ["**/*.test.ts"],
  testTimeout: 120000,
};
