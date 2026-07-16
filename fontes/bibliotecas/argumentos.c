#include "argumentos.h"
#include <string.h>
#include <stdlib.h>

#ifdef _WIN32

// __argc / __argv são globais do CRT (MSVC e MinGW), preenchidos pelo
// código de inicialização antes de chamar main() — independem de main()
// declarar (int argc, char** argv) ou não.

int delegua_arg_quantidade_argumentos(void) {
    return __argc > 1 ? __argc - 1 : 0;
}

char* delegua_arg_argumento(int indice) {
    int total = __argc > 1 ? __argc - 1 : 0;
    if (indice < 0 || indice >= total) return "";
    return __argv[indice + 1];
}

#else

#include <stdio.h>

static char** delegua_arg_argv_cache = NULL;
static int delegua_arg_argc_cache = -1;

// Fallback POSIX: lê /proc/self/cmdline (argumentos separados por '\0').
static void delegua_arg_carregar_argumentos(void) {
    if (delegua_arg_argc_cache >= 0) return;

    FILE* fp = fopen("/proc/self/cmdline", "rb");
    if (!fp) { delegua_arg_argc_cache = 0; return; }

    char buffer[4096];
    size_t lido = fread(buffer, 1, sizeof(buffer) - 1, fp);
    fclose(fp);
    buffer[lido] = '\0';

    int total = 0;
    for (size_t i = 0; i < lido; i++) {
        if (buffer[i] == '\0') total++;
    }
    if (lido > 0 && buffer[lido - 1] != '\0') total++;

    if (total <= 1) { delegua_arg_argc_cache = 0; return; }

    delegua_arg_argv_cache = (char**)malloc((size_t)total * sizeof(char*));
    char* cursor = buffer;
    for (int i = 0; i < total; i++) {
        delegua_arg_argv_cache[i] = strdup(cursor);
        cursor += strlen(cursor) + 1;
    }

    delegua_arg_argc_cache = total - 1; // exclui argv[0]
}

int delegua_arg_quantidade_argumentos(void) {
    delegua_arg_carregar_argumentos();
    return delegua_arg_argc_cache;
}

char* delegua_arg_argumento(int indice) {
    delegua_arg_carregar_argumentos();
    if (indice < 0 || indice >= delegua_arg_argc_cache) return "";
    return delegua_arg_argv_cache[indice + 1];
}

#endif
