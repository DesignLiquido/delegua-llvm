#include "argumentos.h"
#include <string.h>
#include <stdlib.h>

#ifdef _WIN32

// No Windows, __argv vem na página de código ANSI do sistema (ex.: 1252), não em UTF-8, e
// caracteres fora dela se perdem. Os argumentos são lidos da linha de comando em UTF-16
// (GetCommandLineW + CommandLineToArgvW, as mesmas regras de aspas do CRT) e convertidos
// para UTF-8, como todos os textos de Delégua.
#include <windows.h>
#include <shellapi.h>

static char** delegua_arg_argv_cache = NULL;
static int delegua_arg_argc_cache = -1;

static char* delegua_arg_para_utf8(const wchar_t* largo) {
    int tamanho = WideCharToMultiByte(CP_UTF8, 0, largo, -1, NULL, 0, NULL, NULL);
    if (tamanho <= 0) return strdup("");
    char* texto = (char*)malloc((size_t)tamanho);
    if (!texto) return strdup("");
    WideCharToMultiByte(CP_UTF8, 0, largo, -1, texto, tamanho, NULL, NULL);
    return texto;
}

static void delegua_arg_carregar_argumentos(void) {
    if (delegua_arg_argc_cache >= 0) return;
    delegua_arg_argc_cache = 0;

    int total = 0;
    wchar_t** largos = CommandLineToArgvW(GetCommandLineW(), &total);
    if (!largos) return;
    if (total > 1) {
        delegua_arg_argv_cache = (char**)malloc((size_t)total * sizeof(char*));
        if (delegua_arg_argv_cache) {
            for (int i = 0; i < total; i++) {
                delegua_arg_argv_cache[i] = delegua_arg_para_utf8(largos[i]);
            }
            delegua_arg_argc_cache = total - 1; // exclui argv[0]
        }
    }
    LocalFree(largos);
}

int delegua_arg_quantidade_argumentos(void) {
    delegua_arg_carregar_argumentos();
    return delegua_arg_argc_cache;
}

char* delegua_arg_argumento(int indice) {
    delegua_arg_carregar_argumentos();
    if (indice < 0 || indice >= delegua_arg_argc_cache) return strdup("");
    const char* valor = delegua_arg_argv_cache[indice + 1];
    return strdup(valor ? valor : "");
}

#elif defined(__APPLE__)

// macOS não tem /proc: o CRT expõe argc/argv por _NSGetArgc/_NSGetArgv.
#include <crt_externs.h>

int delegua_arg_quantidade_argumentos(void) {
    int total = *_NSGetArgc();
    return total > 1 ? total - 1 : 0;
}

char* delegua_arg_argumento(int indice) {
    int total = *_NSGetArgc();
    if (indice < 0 || indice >= total - 1) return strdup("");
    const char* valor = (*_NSGetArgv())[indice + 1];
    return strdup(valor ? valor : "");
}

#else

#include <stdio.h>

static char** delegua_arg_argv_cache = NULL;
static int delegua_arg_argc_cache = -1;

// Fallback POSIX: lê /proc/self/cmdline (argumentos separados por '\0'), inteiro: a linha
// de comando pode passar de qualquer tamanho fixo de buffer.
static void delegua_arg_carregar_argumentos(void) {
    if (delegua_arg_argc_cache >= 0) return;
    delegua_arg_argc_cache = 0;

    FILE* fp = fopen("/proc/self/cmdline", "rb");
    if (!fp) return;

    size_t capacidade = 4096;
    size_t lido = 0;
    char* buffer = (char*)malloc(capacidade);
    while (buffer) {
        size_t n = fread(buffer + lido, 1, capacidade - lido, fp);
        lido += n;
        if (lido < capacidade) break;
        capacidade *= 2;
        char* maior = (char*)realloc(buffer, capacidade);
        if (!maior) {
            free(buffer);
            buffer = NULL;
        } else {
            buffer = maior;
        }
    }
    fclose(fp);
    if (!buffer) return;

    int total = 0;
    for (size_t i = 0; i < lido; i++) {
        if (buffer[i] == '\0') total++;
    }
    if (lido > 0 && buffer[lido - 1] != '\0') total++;

    if (total > 1) {
        delegua_arg_argv_cache = (char**)malloc((size_t)total * sizeof(char*));
        if (delegua_arg_argv_cache) {
            size_t posicao = 0;
            for (int i = 0; i < total; i++) {
                size_t fim = posicao;
                while (fim < lido && buffer[fim] != '\0') fim++;
                size_t tamanho = fim - posicao;
                char* argumento = (char*)malloc(tamanho + 1);
                if (argumento) {
                    memcpy(argumento, buffer + posicao, tamanho);
                    argumento[tamanho] = '\0';
                }
                delegua_arg_argv_cache[i] = argumento ? argumento : (char*)"";
                posicao = fim + 1;
            }
            delegua_arg_argc_cache = total - 1; // exclui argv[0]
        }
    }
    free(buffer);
}

int delegua_arg_quantidade_argumentos(void) {
    delegua_arg_carregar_argumentos();
    return delegua_arg_argc_cache;
}

char* delegua_arg_argumento(int indice) {
    delegua_arg_carregar_argumentos();
    if (indice < 0 || indice >= delegua_arg_argc_cache) return strdup("");
    const char* valor = delegua_arg_argv_cache[indice + 1];
    return strdup(valor ? valor : "");
}

#endif
