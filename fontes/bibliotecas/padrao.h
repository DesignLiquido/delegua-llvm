#pragma once
#include <stdint.h>

int escreva(const char *fmt, ...);
void *leia(const char *texto, const char *fmt);
int inteiro(void *valor);
double numero(void *valor);
void falhar(const char *msg);