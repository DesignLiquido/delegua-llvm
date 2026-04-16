#include "./padrao.h"
#include <time.h>

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

static int semente_inicializada = 0;

static void inicializar_semente(void) {
    if (!semente_inicializada) {
        srand((unsigned int)time(NULL));
        semente_inicializada = 1;
    }
}

double aleatorio(void) {
    inicializar_semente();
    return (double)rand() / RAND_MAX;
}

int aleatorioEntre(double a, double b) {
    inicializar_semente();
    int ia = (int)a;
    int ib = (int)b;
    if (ia > ib) { int tmp = ia; ia = ib; ib = tmp; }
    return ia + rand() % (ib - ia + 1);
}

char* texto_de_inteiro(int val) {
    char* buf = (char*)malloc(32);
    snprintf(buf, 32, "%d", val);
    return buf;
}

char* texto_de_numero(double val) {
    char* buf = (char*)malloc(64);
    snprintf(buf, 64, "%g", val);
    return buf;
}

char* delegua_formatar(const char* fmt, ...) {
    va_list args;

    // Primeira passagem: calcular o tamanho necessário
    va_start(args, fmt);
    int tamanho = vsnprintf(NULL, 0, fmt, args);
    va_end(args);

    if (tamanho < 0) return NULL;

    char* resultado = (char*)malloc(tamanho + 1);

    if (resultado == NULL) {
        return NULL;
    }

    // Segunda passagem: preencher o buffer
    va_start(args, fmt);
    vsnprintf(resultado, tamanho + 1, fmt, args);
    va_end(args);

    return resultado;
}

void falhar(const char *msg) {
#ifdef _WIN32
  fputs(msg ? msg : "Falha desconhecida.", stderr);
  fputc('\n', stderr);
  abort();
#else
  size_t tamanho = strlen(msg) + 1;
  void* exc = __cxa_allocate_exception(tamanho);
  memcpy(exc, msg, tamanho);
  __cxa_throw(exc, &_ZTIPc, NULL);
#endif
}