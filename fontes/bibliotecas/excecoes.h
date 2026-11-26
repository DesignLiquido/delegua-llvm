#pragma once

// Exceções de Delégua (tente/pegue/falhar) com setjmp/longjmp, sem depender da ABI de
// exceções de C++. As variáveis gerenciadas (ARC) das funções que um `falhar` atravessa são
// liberadas pelos quadros de limpeza de arc.h antes do longjmp.
//
// Cada `tente` em execução tem um quadro, guardado na pilha da função que contém o `tente`
// (área de DELEGUA_TAMANHO_QUADRO_EXCECAO bytes reservada pelo compilador, com o jmp_buf no
// início). O compilador chama delegua_excecao_empilhar e então setjmp sobre essa área.

#define DELEGUA_TAMANHO_QUADRO_EXCECAO 1024

// Torna `quadro` o tratador mais interno.
void        delegua_excecao_empilhar(void* quadro);
// Remove o tratador mais interno (saída normal do corpo de um `tente`, ou retorna/sustar/continua).
void        delegua_excecao_desempilhar(void);

// Lança `objeto` (instância de classe Delégua, ou NULL) com `mensagem`: desvia para o
// tratador mais interno, que é removido. Sem tratador, escreve a mensagem na saída de erro
// e encerra o programa com código 1.
void        delegua_excecao_lancar(void* objeto, const char* mensagem);

// Exceção sendo tratada (no bloco pegue). Referências emprestadas do tempo de execução.
void*       delegua_excecao_atual(void);
const char* delegua_excecao_mensagem_atual(void);
// O pegue já guardou objeto e mensagem nas suas variáveis: o tempo de execução solta os dele.
void        delegua_excecao_concluir(void);
