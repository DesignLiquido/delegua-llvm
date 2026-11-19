#pragma once
#include <stdlib.h>
#include <string.h>

char* delegua_texto_maiusculo(const char* s);
char* delegua_texto_minusculo(const char* s);
int   delegua_texto_inclui(const char* s, const char* sub);
char* delegua_texto_subtexto(const char* s, int inicio, int fim);
char* delegua_texto_substituir(const char* s, const char* de, const char* para);

#include "vetor.h"

// Remove espaços em branco (isspace) do início e do fim.
char* delegua_texto_aparar(const char* s);
char* delegua_texto_aparar_inicio(const char* s);
char* delegua_texto_aparar_fim(const char* s);

// Divide `s` em `delimitador`, preenchendo `saida` com char*. Delimitador vazio
// divide em caracteres. `limite` > 0 limita a quantidade de partes (a última
// parte contém o restante do texto); `limite` <= 0 não limita.
void  delegua_texto_dividir(const char* s, const char* delimitador, int limite, Vetor* saida);

// Índice (em bytes) da primeira ocorrência de `sub` a partir de `inicio`, ou -1.
int   delegua_texto_encontrar(const char* s, const char* sub, int inicio);
// Índice (em bytes) da última ocorrência de `sub`, ou -1.
int   delegua_texto_encontrar_ultimo(const char* s, const char* sub);

int   delegua_texto_comeca_com(const char* s, const char* prefixo);
int   delegua_texto_termina_com(const char* s, const char* sufixo);
char* delegua_texto_concatenar(const char* a, const char* b);
char* delegua_texto_inverter(const char* s);
