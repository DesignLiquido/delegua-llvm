#include "./padrao.h"

// Utilidades

static void remove_nova_linha(char *s)
{
  size_t tamanho = strlen(s);
  if (tamanho > 0 && s[tamanho - 1] == '\n')
  {
    s[tamanho - 1] = '\0';
  }
}

// Implementações

int escreva(const char *fmt, ...)
{
  va_list ap;
  va_start(ap, fmt);
  int r = vprintf(fmt, ap);
  va_end(ap);
  return r;
}

void *leia(const char *texto, const char *fmt)
{
  if (texto)
  {
    fputs(texto, stdout);
    fflush(stdout);
  }

  char buffer[1024];
  if (!fgets(buffer, sizeof(buffer), stdin))
  {
    return NULL;
  }
  remove_nova_linha(buffer);

  // Retorna string alocada
  if (strcmp(fmt, "%s") == 0)
  {
    size_t tamanho = strlen(buffer);
    char *saida = malloc(tamanho + 1);
    if (!saida)
      return NULL;
    memcpy(saida, buffer, tamanho + 1);
    return saida;
  }

  // Inteiro
  if (strcmp(fmt, "%d") == 0)
  {
    int *saida = malloc(sizeof(int));
    if (!saida)
      return NULL;
    if (sscanf(buffer, "%d", saida) != 1)
    {
      free(saida);
      return NULL;
    }
    return saida;
  }

  // Double (%lf)
  if (strcmp(fmt, "%lf") == 0)
  {
    double *saida = malloc(sizeof(double));
    if (!saida)
      return NULL;
    if (sscanf(buffer, "%lf", saida) != 1)
    {
      free(saida);
      return NULL;
    }
    return saida;
  }

  // Não suportado.
  return NULL;
}

int inteiro(void *valor) {
  char *s = (char*) valor;

  return strtol(s, NULL, 10);
}

double numero(void *valor) {
  char *s = (char*) valor;

  return strtod(s, NULL);
}

void falhar(const char *msg) {
  size_t tamanho = strlen(msg) + 1;
  void* exc = __cxa_allocate_exception(tamanho);
  memcpy(exc, msg, tamanho);
  __cxa_throw(exc, &_ZTIPc, NULL);
}