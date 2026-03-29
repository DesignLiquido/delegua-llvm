#pragma once
#include <stdlib.h>
#include <string.h>

typedef struct {
    void* ptr;
    int tamanho;
} Vetor;

// Retorna o número de elementos no vetor.
int delegua_vetor_tamanho(Vetor* v);

// Mapeia elementos texto (char*→char*) — cria novo vetor em *saida.
void delegua_vetor_mapear_texto(Vetor* v, char* (*fn)(char*), Vetor* saida);

// Adiciona um elemento ao final do vetor. Retorna o novo tamanho.
int delegua_vetor_adicionar(Vetor* v, void* elem, int tam_elem);

// Remove o último elemento. Retorna o novo tamanho (-1 se já vazio).
int delegua_vetor_remover_ultimo(Vetor* v);

// Remove o primeiro elemento (shift). Retorna o novo tamanho (-1 se já vazio).
int delegua_vetor_remover_primeiro(Vetor* v, int tam_elem);

// Inverte os elementos in-place.
void delegua_vetor_inverter(Vetor* v, int tam_elem);

// Ordena os elementos in-place (eh_numero: 0 = inteiro, 1 = número/double).
void delegua_vetor_ordenar(Vetor* v, int tam_elem, int eh_numero);

// Fatia o vetor [inicio, fim) e preenche *saida (out-param para evitar ABI de struct).
void delegua_vetor_fatiar(Vetor* v, int inicio, int fim, int tam_elem, Vetor* saida);

// Junta elementos inteiros como texto separado por sep.
char* delegua_vetor_juntar_inteiro(Vetor* v, const char* sep);

// Junta elementos número (double) como texto separado por sep.
char* delegua_vetor_juntar_numero(Vetor* v, const char* sep);

// Junta elementos texto (char*) separados por sep.
char* delegua_vetor_juntar_texto(Vetor* v, const char* sep);

// Filtra elementos inteiros usando predicado — cria novo vetor em *saida.
void delegua_vetor_filtrar_inteiro(Vetor* v, int (*fn)(int), Vetor* saida);

// Filtra elementos número (double) usando predicado — cria novo vetor em *saida.
void delegua_vetor_filtrar_numero(Vetor* v, int (*fn)(double), Vetor* saida);

// Mapeia elementos inteiros (int→int) — cria novo vetor em *saida.
void delegua_vetor_mapear_inteiro(Vetor* v, int (*fn)(int), Vetor* saida);

// Mapeia elementos número (double→double) — cria novo vetor em *saida.
void delegua_vetor_mapear_numero(Vetor* v, double (*fn)(double), Vetor* saida);
