#pragma once
#include <stdlib.h>
#include <string.h>

// Deve coincidir com %Vetor = type { ptr, i32, i32, i32, i32 } do IR gerado.
// O próprio Vetor é uma alocação ARC (ver arc.h); `ptr` é um buffer interno do vetor.
typedef struct {
    void* ptr;
    int tamanho;
    int capacidade;
    int tam_elem;
    // 1 quando os elementos são ponteiros gerenciados (texto, objetos, vetores, dicionários):
    // o vetor retém o que guarda e libera o que remove ou ao ser destruído.
    int gerenciado;
} Vetor;

// Aloca um novo Vetor (ARC, +1) com `tamanho_inicial` elementos zerados de tamanho `tam_elem`.
Vetor* delegua_vetor_criar(int tamanho_inicial, int tam_elem, int gerenciado);

// Retorna o número de elementos no vetor.
int delegua_vetor_tamanho(Vetor* v);

// Mapeia elementos texto (char*→char*) — cria e retorna novo Vetor*.
Vetor* delegua_vetor_mapear_texto(Vetor* v, char* (*fn)(char*));

// Adiciona um elemento ao final do vetor. Retorna o novo tamanho.
int delegua_vetor_adicionar(Vetor* v, void* elem, int tam_elem);

// Escreve um elemento na posição `indice`, crescendo (realocando) o vetor se
// `indice >= tamanho` atual — posições intermediárias deixadas "para trás" são
// zeradas. Retorna um ponteiro para a posição de memória do elemento (para o
// chamador copiar o valor nela), ou NULL em caso de erro.
void* delegua_vetor_definir_indice(Vetor* v, int indice, int tam_elem);

// Remove o último elemento. Retorna o novo tamanho (-1 se já vazio).
int delegua_vetor_remover_ultimo(Vetor* v);

// Remove o primeiro elemento (shift). Retorna o novo tamanho (-1 se já vazio).
int delegua_vetor_remover_primeiro(Vetor* v, int tam_elem);

// Inverte os elementos in-place.
void delegua_vetor_inverter(Vetor* v, int tam_elem);

// Ordena os elementos in-place, em ordem crescente.
// tipo: 0 = inteiro, 1 = número (double), 2 = texto (char*, ordem dos bytes, como strcmp).
void delegua_vetor_ordenar(Vetor* v, int tam_elem, int tipo);

// Ordena in-place com uma função de comparação que recebe ponteiros para dois elementos e
// devolve > 0 quando o primeiro deve vir depois do segundo. A ordenação é estável:
// elementos considerados iguais mantêm a ordem original.
void delegua_vetor_ordenar_com_funcao(Vetor* v, int tam_elem, int (*comparar)(const void*, const void*));

// Fatia o vetor [inicio, fim) e retorna novo Vetor*.
Vetor* delegua_vetor_fatiar(Vetor* v, int inicio, int fim, int tam_elem);

// Junta elementos inteiros como texto separado por sep.
char* delegua_vetor_juntar_inteiro(Vetor* v, const char* sep);

// Junta elementos número (double) como texto separado por sep.
char* delegua_vetor_juntar_numero(Vetor* v, const char* sep);

// Junta elementos texto (char*) separados por sep.
char* delegua_vetor_juntar_texto(Vetor* v, const char* sep);

// Filtra elementos inteiros usando predicado — retorna novo Vetor*.
Vetor* delegua_vetor_filtrar_inteiro(Vetor* v, int (*fn)(int));

// Filtra elementos número (double) usando predicado — retorna novo Vetor*.
Vetor* delegua_vetor_filtrar_numero(Vetor* v, int (*fn)(double));

// Mapeia elementos inteiros (int→int) — retorna novo Vetor*.
Vetor* delegua_vetor_mapear_inteiro(Vetor* v, int (*fn)(int));

// Mapeia elementos número (double→double) — retorna novo Vetor*.
Vetor* delegua_vetor_mapear_numero(Vetor* v, double (*fn)(double));

// Verifica se o vetor de char* contém a string s (strcmp). Retorna 1 se sim, 0 caso contrário.
int delegua_vetor_inclui_texto(Vetor* v, const char* s);
