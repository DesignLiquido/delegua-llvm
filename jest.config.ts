import type { Config } from '@jest/types';

export default async (): Promise<Config.InitialOptions> => {
    return {
        verbose: true,
        modulePathIgnorePatterns: ['<rootDir>/dist/'],
        preset: 'ts-jest',
        testEnvironment: 'node',
        coverageReporters: ['json-summary', 'lcov', 'text', 'text-summary'],
        coveragePathIgnorePatterns: [],
        coverageThreshold: {
            global: {
                branches: 64,
                functions: 90,
                lines: 79,
                statements: 79,
            },
        },
    };
};
