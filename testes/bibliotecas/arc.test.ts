/// <reference types="jest" />
import { execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Testa o tempo de execução ARC diretamente em C (arc-teste.c): contagem de referências, destrutores de
// Vetor, Dicionario, JsonRef e TabelaCsv, e ausência de alocações vivas ao final.
// Precisa do clang (o ambiente de testes de unidade pode não ter).
const temClang = spawnSync('clang', ['--version'], { stdio: 'ignore' }).status === 0;
const descrever = temClang ? describe : describe.skip;

const BIBLIOTECAS = path.resolve(__dirname, '..', '..', 'fontes', 'bibliotecas');
const FONTES = ['arc.c', 'vetor.c', 'texto.c', 'dicionario.c', 'json.c', 'csv.c'].map((arquivo) =>
    path.join(BIBLIOTECAS, arquivo)
);

descrever('Runtime ARC (C)', () => {
    let diretorio = '';

    beforeAll(() => {
        diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'delegua-arc-'));
    });

    afterAll(() => {
        fs.rmSync(diretorio, { recursive: true, force: true });
    });

    function compilar(nome: string, flagsExtras: string[]): string {
        const executavel = path.join(diretorio, process.platform === 'win32' ? `${nome}.exe` : nome);
        execFileSync(
            'clang',
            [
                '-Wno-deprecated-declarations',
                ...flagsExtras,
                '-I',
                BIBLIOTECAS,
                path.join(__dirname, 'arc-teste.c'),
                ...FONTES,
                '-o',
                executavel,
            ],
            { stdio: 'pipe' }
        );
        return executavel;
    }

    it('reter, liberar e destrutores não deixam alocações vivas', () => {
        const saida = execFileSync(compilar('arc-teste', ['-O1']), { encoding: 'utf-8' });
        expect(saida.trim()).toBe('vivas=0 falhas=0');
    }, 120000);

    it('sem erros de memória sob AddressSanitizer', () => {
        let executavel: string;
        try {
            executavel = compilar('arc-teste-asan', ['-g', '-fsanitize=address']);
        } catch {
            // Sem o tempo de execução do ASan instalado: nada a verificar neste ambiente.
            return;
        }
        const resultado = spawnSync(executavel, [], { encoding: 'utf-8' });
        if (resultado.error) return; // DLL do ASan fora do PATH (Windows)
        expect(resultado.stderr).not.toContain('AddressSanitizer');
        expect(resultado.stdout.trim()).toBe('vivas=0 falhas=0');
    }, 120000);
});
