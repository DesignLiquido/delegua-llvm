#include "memoria.h"
#include <stdlib.h>
#include <string.h>

// memcpy em vez de desreferência direta: endereços vindos de código C (ou de
// deslocamentos calculados à mão) não têm alinhamento garantido.

void* delegua_memoria_alocar(int bytes) {
    if (bytes <= 0) return NULL;
    return calloc(1, (size_t)bytes);
}

void delegua_memoria_liberar(void* ponteiro) {
    free(ponteiro);
}

int delegua_memoria_tamanho_ponteiro(void) {
    return (int)sizeof(void*);
}

void* delegua_memoria_deslocar(void* ponteiro, int64_t bytes) {
    if (!ponteiro) return NULL;
    return (char*)ponteiro + bytes;
}

void delegua_memoria_copiar(void* destino, void* origem, int64_t bytes) {
    if (!destino || !origem || bytes <= 0) return;
    memmove(destino, origem, (size_t)bytes);
}

#define LER(tipo, base, deslocamento)                                  \
    do {                                                               \
        tipo valor;                                                    \
        if (!(base)) return 0;                                         \
        memcpy(&valor, (char*)(base) + (deslocamento), sizeof(valor)); \
        return valor;                                                  \
    } while (0)

#define ESCREVER(base, deslocamento, valor)                                \
    do {                                                                   \
        if (!(base)) return;                                               \
        memcpy((char*)(base) + (deslocamento), &(valor), sizeof(valor));   \
    } while (0)

void* delegua_memoria_ler_ponteiro(void* base, int64_t deslocamento) { LER(void*, base, deslocamento); }
int delegua_memoria_ler_inteiro(void* base, int64_t deslocamento) { LER(int, base, deslocamento); }
int64_t delegua_memoria_ler_longo(void* base, int64_t deslocamento) { LER(int64_t, base, deslocamento); }
double delegua_memoria_ler_numero(void* base, int64_t deslocamento) { LER(double, base, deslocamento); }

int delegua_memoria_ler_byte(void* base, int64_t deslocamento) {
    if (!base) return 0;
    return ((unsigned char*)base)[deslocamento];
}

void delegua_memoria_escrever_ponteiro(void* base, int64_t deslocamento, void* valor) { ESCREVER(base, deslocamento, valor); }
void delegua_memoria_escrever_inteiro(void* base, int64_t deslocamento, int valor) { ESCREVER(base, deslocamento, valor); }
void delegua_memoria_escrever_longo(void* base, int64_t deslocamento, int64_t valor) { ESCREVER(base, deslocamento, valor); }
void delegua_memoria_escrever_numero(void* base, int64_t deslocamento, double valor) { ESCREVER(base, deslocamento, valor); }

void delegua_memoria_escrever_byte(void* base, int64_t deslocamento, int valor) {
    if (!base) return;
    ((unsigned char*)base)[deslocamento] = (unsigned char)valor;
}

char* delegua_memoria_texto_de_tamanho(void* ponteiro, int64_t bytes) {
    if (!ponteiro || bytes < 0) return NULL;
    char* copia = (char*)malloc((size_t)bytes + 1);
    if (!copia) return NULL;
    memcpy(copia, ponteiro, (size_t)bytes);
    copia[bytes] = '\0';
    return copia;
}

char* delegua_memoria_texto_de(void* ponteiro) {
    if (!ponteiro) return NULL;
    return delegua_memoria_texto_de_tamanho(ponteiro, (int64_t)strlen((const char*)ponteiro));
}

char* delegua_memoria_ler_texto(void* base, int64_t deslocamento) {
    return delegua_memoria_texto_de(delegua_memoria_ler_ponteiro(base, deslocamento));
}
