import type { Config } from '@jest/types';

export default async (): Promise<Config.InitialOptions> => {
    return {
        verbose: true,
        modulePathIgnorePatterns: ['<rootDir>/dist/'],
        preset: 'ts-jest',
        testEnvironment: 'node',
        // Programas executados pelos testes rodam no modo estrito do ARC (ver o arquivo).
        setupFiles: ['<rootDir>/testes/configuracao-arc.ts'],
        coverageReporters: ['json-summary', 'lcov', 'text', 'text-summary'],
        coveragePathIgnorePatterns: []
    };
};
