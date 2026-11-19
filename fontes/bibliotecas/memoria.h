#pragma once
#include <stdint.h>

// Acesso a memória bruta para FFI: parâmetros de saída (T** saida), buffers e
// campos de estruturas C sem declaração. `deslocamento` é em bytes.

// Bloco de `bytes` bytes zerados (calloc). NULL se bytes <= 0 ou sem memória.
void*   delegua_memoria_alocar(int bytes);
void    delegua_memoria_liberar(void* ponteiro);
int     delegua_memoria_tamanho_ponteiro(void);
void*   delegua_memoria_deslocar(void* ponteiro, int64_t bytes);
// Copia `bytes` bytes de origem para destino (áreas podem se sobrepor).
void    delegua_memoria_copiar(void* destino, void* origem, int64_t bytes);

void*   delegua_memoria_ler_ponteiro(void* base, int64_t deslocamento);
int     delegua_memoria_ler_inteiro(void* base, int64_t deslocamento);
int64_t delegua_memoria_ler_longo(void* base, int64_t deslocamento);
double  delegua_memoria_ler_numero(void* base, int64_t deslocamento);
int     delegua_memoria_ler_byte(void* base, int64_t deslocamento);
// Cópia do texto apontado pelo char* guardado em base+deslocamento (NULL se o char* for NULL).
char*   delegua_memoria_ler_texto(void* base, int64_t deslocamento);

void    delegua_memoria_escrever_ponteiro(void* base, int64_t deslocamento, void* valor);
void    delegua_memoria_escrever_inteiro(void* base, int64_t deslocamento, int valor);
void    delegua_memoria_escrever_longo(void* base, int64_t deslocamento, int64_t valor);
void    delegua_memoria_escrever_numero(void* base, int64_t deslocamento, double valor);
void    delegua_memoria_escrever_byte(void* base, int64_t deslocamento, int valor);

// Cópia dos caracteres em `ponteiro` até o '\0' (NULL se ponteiro for NULL).
char*   delegua_memoria_texto_de(void* ponteiro);
// Cópia de exatamente `bytes` bytes em `ponteiro`, terminada em '\0'.
char*   delegua_memoria_texto_de_tamanho(void* ponteiro, int64_t bytes);
