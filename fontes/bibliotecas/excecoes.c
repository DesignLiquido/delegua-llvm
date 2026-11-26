#include "excecoes.h"
#include "arc.h"

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
    // Topo dos quadros de limpeza ARC quando o `tente` começou (ver arc.h).
    void* limpeza;
} QuadroExcecao;

// A área reservada pelo compilador precisa caber o quadro em todas as plataformas.
typedef char verificar_tamanho_quadro[sizeof(QuadroExcecao) <= DELEGUA_TAMANHO_QUADRO_EXCECAO ? 1 : -1];

static QuadroExcecao* topo = NULL;
// Exceção em voo / sendo tratada. O tempo de execução é dono de uma referência a cada um (ARC) até
// delegua_excecao_concluir ou o próximo lançamento.
static void* objeto_atual = NULL;
static char* mensagem_atual = NULL;

void delegua_excecao_empilhar(void* quadro) {
    QuadroExcecao* novo = (QuadroExcecao*)quadro;
    novo->anterior = topo;
    novo->limpeza = delegua_arc_quadro_topo();
    topo = novo;
}

void delegua_excecao_desempilhar(void) {
    if (topo) topo = topo->anterior;
}

void delegua_excecao_lancar(void* objeto, const char* mensagem) {
    // Retém/copia antes de soltar os anteriores (podem ser os mesmos) e antes de desenrolar:
    // liberar os slots das funções abandonadas não pode destruir a exceção em voo.
    char* copia = delegua_arc_texto_copiar(mensagem ? mensagem : "");
    delegua_arc_atribuir(&objeto_atual, objeto);
    delegua_arc_liberar(mensagem_atual);
    mensagem_atual = copia;
    if (!topo) {
        fflush(stdout);
        fprintf(stderr, "Erro não tratado: %s\n", mensagem_atual);
        fflush(stderr);
        exit(1);
    }
    QuadroExcecao* destino = topo;
    topo = destino->anterior;
    // Funções entre o `falhar` e o `tente` não executam seus retornos: libera os slots delas.
    delegua_arc_desenrolar_ate(destino->limpeza);
    longjmp(destino->ponto, 1);
}

void* delegua_excecao_atual(void) {
    return objeto_atual;
}

const char* delegua_excecao_mensagem_atual(void) {
    return mensagem_atual ? mensagem_atual : "";
}

void delegua_excecao_concluir(void) {
    void* objeto = objeto_atual;
    char* mensagem = mensagem_atual;
    objeto_atual = NULL;
    mensagem_atual = NULL;
    delegua_arc_liberar(objeto);
    delegua_arc_liberar(mensagem);
}
