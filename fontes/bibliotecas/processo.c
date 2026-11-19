#include "processo.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifdef _WIN32
    #include <windows.h>
#else
    #include <errno.h>
    #include <fcntl.h>
    #include <sys/types.h>
    #include <sys/wait.h>
    #include <unistd.h>
#endif

static int ultimo_codigo_saida = 0;

// ── Buffer de texto que cresce por duplicação ───────────────────────────────

typedef struct {
    char* dados;
    size_t tamanho;
    size_t capacidade;
} BufferTexto;

static int buffer_garantir(BufferTexto* b, size_t adicional) {
    if (b->tamanho + adicional + 1 <= b->capacidade) return 1;
    size_t nova = b->capacidade ? b->capacidade : 256;
    while (b->tamanho + adicional + 1 > nova) nova *= 2;
    char* novos = (char*)realloc(b->dados, nova);
    if (!novos) return 0;
    b->dados = novos;
    b->capacidade = nova;
    return 1;
}

static void buffer_anexar(BufferTexto* b, const char* trecho, size_t tamanho) {
    if (!buffer_garantir(b, tamanho)) return;
    memcpy(b->dados + b->tamanho, trecho, tamanho);
    b->tamanho += tamanho;
    b->dados[b->tamanho] = '\0';
}

#ifdef _WIN32
// Usado apenas na montagem da linha de comando do Windows.
static void buffer_anexar_caractere(BufferTexto* b, char c, size_t repeticoes) {
    if (!buffer_garantir(b, repeticoes)) return;
    for (size_t i = 0; i < repeticoes; i++) b->dados[b->tamanho++] = c;
    b->dados[b->tamanho] = '\0';
}
#endif

static char* buffer_finalizar(BufferTexto* b) {
    if (!b->dados) {
        char* vazio = (char*)malloc(1);
        if (vazio) vazio[0] = '\0';
        return vazio;
    }
    return b->dados;
}

// ── Informações do processo ─────────────────────────────────────────────────

void delegua_processo_sair(int codigo) {
    fflush(stdout);
    fflush(stderr);
    exit(codigo);
}

void delegua_processo_escrever_erro(char* texto) {
    fflush(stdout);
    fputs(texto ? texto : "", stderr);
    fputc('\n', stderr);
    fflush(stderr);
}

char* delegua_processo_sistema_operacional(void) {
#if defined(_WIN32)
    return (char*)"windows";
#elif defined(__APPLE__)
    return (char*)"darwin";
#elif defined(__linux__)
    return (char*)"linux";
#elif defined(__FreeBSD__)
    return (char*)"freebsd";
#elif defined(__wasm__)
    return (char*)"wasm";
#else
    return (char*)"desconhecido";
#endif
}

char* delegua_processo_arquitetura(void) {
#if defined(__x86_64__) || defined(_M_X64)
    return (char*)"amd64";
#elif defined(__aarch64__) || defined(_M_ARM64)
    return (char*)"arm64";
#elif defined(__i386__) || defined(_M_IX86)
    return (char*)"386";
#elif defined(__arm__) || defined(_M_ARM)
    return (char*)"arm";
#elif defined(__riscv) && (__riscv_xlen == 64)
    return (char*)"riscv64";
#elif defined(__wasm32__)
    return (char*)"wasm32";
#else
    return (char*)"desconhecida";
#endif
}

char* delegua_processo_variavel_ambiente(char* nome) {
    if (!nome) return NULL;
    const char* valor = getenv(nome);
    if (!valor) return NULL;
    size_t tamanho = strlen(valor);
    char* copia = (char*)malloc(tamanho + 1);
    if (!copia) return NULL;
    memcpy(copia, valor, tamanho + 1);
    return copia;
}

int delegua_processo_definir_variavel_ambiente(char* nome, char* valor) {
    if (!nome || !*nome) return 0;
#ifdef _WIN32
    return _putenv_s(nome, valor ? valor : "") == 0 ? 1 : 0;
#else
    return setenv(nome, valor ? valor : "", 1) == 0 ? 1 : 0;
#endif
}

int delegua_processo_ultimo_codigo_saida(void) {
    return ultimo_codigo_saida;
}

// ── Execução de programas ───────────────────────────────────────────────────

#ifdef _WIN32

// Acrescenta um argumento à linha de comando seguindo as regras de CommandLineToArgvW /
// do CRT da Microsoft: aspas em volta quando necessário, barras invertidas duplicadas
// apenas antes de aspas.
static void anexar_argumento_windows(BufferTexto* linha, const char* argumento) {
    if (*argumento && !strpbrk(argumento, " \t\n\v\"")) {
        buffer_anexar(linha, argumento, strlen(argumento));
        return;
    }
    buffer_anexar_caractere(linha, '"', 1);
    for (const char* p = argumento;; p++) {
        size_t barras = 0;
        while (*p == '\\') {
            p++;
            barras++;
        }
        if (!*p) {
            buffer_anexar_caractere(linha, '\\', barras * 2);
            break;
        }
        if (*p == '"') {
            buffer_anexar_caractere(linha, '\\', barras * 2 + 1);
            buffer_anexar_caractere(linha, '"', 1);
        } else {
            buffer_anexar_caractere(linha, '\\', barras);
            buffer_anexar_caractere(linha, *p, 1);
        }
    }
    buffer_anexar_caractere(linha, '"', 1);
}

static int termina_com_sem_caixa(const char* texto, const char* sufixo) {
    size_t t = strlen(texto), s = strlen(sufixo);
    return t >= s && _stricmp(texto + t - s, sufixo) == 0;
}

// Localiza o programa no PATH testando as extensões usuais (programa.exe, programa.cmd...),
// para que `executar("npm", ...)` funcione como em sistemas Unix.
static void resolver_programa_windows(const char* programa, char* resolvido, DWORD tamanho) {
    const char* extensoes[] = {".exe", ".cmd", ".bat", ".com"};
    if (!strpbrk(programa, "\\/") && !strchr(programa, '.')) {
        for (size_t i = 0; i < sizeof(extensoes) / sizeof(extensoes[0]); i++) {
            if (SearchPathA(NULL, programa, extensoes[i], tamanho, resolvido, NULL) > 0) return;
        }
    }
    strncpy(resolvido, programa, tamanho - 1);
    resolvido[tamanho - 1] = '\0';
}

static int executar_interno(char* programa, Vetor* argumentos, char* diretorio, BufferTexto* captura) {
    char programaResolvido[MAX_PATH * 2];
    resolver_programa_windows(programa, programaResolvido, sizeof(programaResolvido));
    int ehLote = termina_com_sem_caixa(programaResolvido, ".cmd") || termina_com_sem_caixa(programaResolvido, ".bat");

    int quantidade = argumentos ? argumentos->tamanho : 0;
    char** valores = argumentos ? (char**)argumentos->ptr : NULL;

    BufferTexto linha = {0};
    if (ehLote) {
        // Arquivos de lote são interpretados pelo cmd.exe, que expande %VAR% e trata aspas
        // de forma própria mesmo dentro de argumentos entre aspas. Recusar esses caracteres
        // evita injeção de comandos através dos argumentos.
        for (int i = 0; i < quantidade; i++) {
            if (valores[i] && strpbrk(valores[i], "%\"\r\n")) {
                fprintf(stderr, "[DELEGUA ERRO] processo.executar: argumento inseguro para arquivo de lote: %s\n", valores[i]);
                fflush(stderr);
                return -1;
            }
        }
        buffer_anexar(&linha, "cmd.exe /d /s /c \"", 18);
    }
    anexar_argumento_windows(&linha, programaResolvido);
    for (int i = 0; i < quantidade; i++) {
        buffer_anexar_caractere(&linha, ' ', 1);
        anexar_argumento_windows(&linha, valores[i] ? valores[i] : "");
    }
    if (ehLote) buffer_anexar_caractere(&linha, '"', 1);
    if (!linha.dados) return -1;

    SECURITY_ATTRIBUTES atributos = {sizeof(SECURITY_ATTRIBUTES), NULL, TRUE};
    HANDLE leitura = NULL, escrita = NULL;
    STARTUPINFOA inicio;
    PROCESS_INFORMATION informacoes;
    ZeroMemory(&inicio, sizeof(inicio));
    ZeroMemory(&informacoes, sizeof(informacoes));
    inicio.cb = sizeof(inicio);

    if (captura) {
        if (!CreatePipe(&leitura, &escrita, &atributos, 0)) {
            free(linha.dados);
            return -1;
        }
        SetHandleInformation(leitura, HANDLE_FLAG_INHERIT, 0);
        inicio.dwFlags = STARTF_USESTDHANDLES;
        inicio.hStdInput = GetStdHandle(STD_INPUT_HANDLE);
        inicio.hStdOutput = escrita;
        inicio.hStdError = GetStdHandle(STD_ERROR_HANDLE);
    }

    fflush(stdout);
    fflush(stderr);
    BOOL criado = CreateProcessA(
        NULL, linha.dados, NULL, NULL, TRUE, 0, NULL,
        (diretorio && *diretorio) ? diretorio : NULL, &inicio, &informacoes);
    free(linha.dados);

    if (captura) CloseHandle(escrita);
    if (!criado) {
        if (captura) CloseHandle(leitura);
        return -1;
    }

    if (captura) {
        char bloco[4096];
        DWORD lidos;
        while (ReadFile(leitura, bloco, sizeof(bloco), &lidos, NULL) && lidos > 0) {
            buffer_anexar(captura, bloco, lidos);
        }
        CloseHandle(leitura);
    }

    WaitForSingleObject(informacoes.hProcess, INFINITE);
    DWORD codigo = (DWORD)-1;
    GetExitCodeProcess(informacoes.hProcess, &codigo);
    CloseHandle(informacoes.hProcess);
    CloseHandle(informacoes.hThread);
    return (int)codigo;
}

#else

static int executar_interno(char* programa, Vetor* argumentos, char* diretorio, BufferTexto* captura) {
    int quantidade = argumentos ? argumentos->tamanho : 0;
    char** valores = argumentos ? (char**)argumentos->ptr : NULL;

    char** argv = (char**)malloc((size_t)(quantidade + 2) * sizeof(char*));
    if (!argv) return -1;
    argv[0] = programa;
    for (int i = 0; i < quantidade; i++) argv[i + 1] = valores[i] ? valores[i] : (char*)"";
    argv[quantidade + 1] = NULL;

    int canal[2] = {-1, -1};
    if (captura && pipe(canal) != 0) {
        free(argv);
        return -1;
    }

    // Canal de erro com close-on-exec: fica vazio se execvp tiver sucesso; se falhar,
    // o filho escreve errno nele, e o pai sabe que o programa não pôde ser iniciado.
    int canalErro[2];
    if (pipe(canalErro) != 0) {
        if (captura) {
            close(canal[0]);
            close(canal[1]);
        }
        free(argv);
        return -1;
    }
    fcntl(canalErro[1], F_SETFD, FD_CLOEXEC);

    fflush(stdout);
    fflush(stderr);
    pid_t pid = fork();
    if (pid < 0) {
        if (captura) {
            close(canal[0]);
            close(canal[1]);
        }
        close(canalErro[0]);
        close(canalErro[1]);
        free(argv);
        return -1;
    }

    if (pid == 0) {
        close(canalErro[0]);
        if (captura) {
            dup2(canal[1], STDOUT_FILENO);
            close(canal[0]);
            close(canal[1]);
        }
        if (!(diretorio && *diretorio && chdir(diretorio) != 0)) {
            execvp(programa, argv);
        }
        int erro = errno;
        ssize_t escritos = write(canalErro[1], &erro, sizeof(erro));
        (void)escritos;
        _exit(127);
    }

    free(argv);
    close(canalErro[1]);
    if (captura) {
        close(canal[1]);
        char bloco[4096];
        ssize_t lidos;
        while ((lidos = read(canal[0], bloco, sizeof(bloco))) != 0) {
            if (lidos < 0) {
                if (errno == EINTR) continue;
                break;
            }
            buffer_anexar(captura, bloco, (size_t)lidos);
        }
        close(canal[0]);
    }

    int erroFilho = 0;
    ssize_t lidosErro;
    do {
        lidosErro = read(canalErro[0], &erroFilho, sizeof(erroFilho));
    } while (lidosErro < 0 && errno == EINTR);
    close(canalErro[0]);

    int estado = 0;
    while (waitpid(pid, &estado, 0) < 0) {
        if (errno != EINTR) return -1;
    }
    if (lidosErro > 0) return -1;
    if (WIFEXITED(estado)) return WEXITSTATUS(estado);
    if (WIFSIGNALED(estado)) return 128 + WTERMSIG(estado);
    return -1;
}

#endif

int delegua_processo_executar(char* programa, Vetor* argumentos, char* diretorio) {
    if (!programa || !*programa) {
        ultimo_codigo_saida = -1;
        return -1;
    }
    ultimo_codigo_saida = executar_interno(programa, argumentos, diretorio, NULL);
    return ultimo_codigo_saida;
}

char* delegua_processo_executar_capturando(char* programa, Vetor* argumentos, char* diretorio) {
    BufferTexto saida = {0};
    if (!programa || !*programa) {
        ultimo_codigo_saida = -1;
        return buffer_finalizar(&saida);
    }
    ultimo_codigo_saida = executar_interno(programa, argumentos, diretorio, &saida);
    return buffer_finalizar(&saida);
}
