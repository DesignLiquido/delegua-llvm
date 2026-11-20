#pragma once
#include <stdint.h>
#include <stdio.h>
#include <stdarg.h>
#include <stdlib.h>
#include <string.h>
#include <stddef.h>

int escreva(const char *fmt, ...);
void *leia(const char *texto, const char *fmt);
int inteiro(void *valor);
double numero(void *valor);
// Lança uma exceção Delégua com a mensagem (ver excecoes.h).
void falhar(const char *msg);
double aleatorio(void);
int aleatorioEntre(double a, double b);
char* texto_de_inteiro(int val);
char* texto_de_numero(double val);
char* texto_de_longo(long long val);
char* delegua_formatar(const char* fmt, ...);