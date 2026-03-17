#pragma once
#include <stdlib.h>
#include <string.h>

char* delegua_texto_maiusculo(const char* s);
char* delegua_texto_minusculo(const char* s);
int   delegua_texto_inclui(const char* s, const char* sub);
char* delegua_texto_subtexto(const char* s, int inicio, int fim);
char* delegua_texto_substituir(const char* s, const char* de, const char* para);
