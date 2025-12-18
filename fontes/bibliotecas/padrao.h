#pragma once
#include <stdint.h>
#include <stdio.h>
#include <stdarg.h>
#include <stdlib.h>
#include <string.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

void* __cxa_allocate_exception(size_t thrown_size);
void  __cxa_throw(void* thrown_exception, void* tinfo, void (*dest)(void*));
void* __cxa_begin_catch(void* exception_header);
void  __cxa_end_catch(void);

extern void* _ZTIPc;

#ifdef __cplusplus
}
#endif

int escreva(const char *fmt, ...);
void *leia(const char *texto, const char *fmt);
int inteiro(void *valor);
double numero(void *valor);
void falhar(const char *msg);