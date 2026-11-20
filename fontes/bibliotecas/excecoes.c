#include "excecoes.h"

// MinGW: setjmp/longjmp sem desempilhamento SEH, para combinar com a chamada que o
// compilador emite (_setjmp(buf, NULL) em x86-64; __mingw_setjmp(buf) em ARM64).
#if defined(__MINGW32__) && !defined(__USE_MINGW_SETJMP_NON_SEH)
#define __USE_MINGW_SETJMP_NON_SEH
#endif
#include <setjmp.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>

typedef struct QuadroExcecao {
    // Primeiro campo: o compilador chama setjmp sobre o início da área.
    jmp_buf ponto;
    struct QuadroExcecao* anterior;
} QuadroExcecao;

// A área reservada pelo compilador precisa caber o quadro em todas as plataformas.
typedef char verificar_tamanho_quadro[sizeof(QuadroExcecao) <= DELEGUA_TAMANHO_QUADRO_EXCECAO ? 1 : -1];

static QuadroExcecao* topo = NULL;
static void* objeto_atual = NULL;
static const char* mensagem_atual = NULL;

void delegua_excecao_empilhar(void* quadro) {
    QuadroExcecao* novo = (QuadroExcecao*)quadro;
    novo->anterior = topo;
    topo = novo;
}

void delegua_excecao_desempilhar(void) {
    if (topo) topo = topo->anterior;
}

void delegua_excecao_lancar(void* objeto, const char* mensagem) {
    objeto_atual = objeto;
    mensagem_atual = mensagem ? mensagem : "";
    if (!topo) {
        fflush(stdout);
        fprintf(stderr, "Erro não tratado: %s\n", mensagem_atual);
        fflush(stderr);
        exit(1);
    }
    QuadroExcecao* destino = topo;
    topo = destino->anterior;
    longjmp(destino->ponto, 1);
}

void* delegua_excecao_atual(void) {
    return objeto_atual;
}

const char* delegua_excecao_mensagem_atual(void) {
    return mensagem_atual ? mensagem_atual : "";
}
