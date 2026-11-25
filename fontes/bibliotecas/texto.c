#include "./texto.h"
#include <ctype.h>

char* delegua_texto_maiusculo(const char* s) {
    size_t tam = strlen(s);
    char* resultado = (char*)malloc(tam + 1);
    for (size_t i = 0; i <= tam; i++) {
        resultado[i] = (char)toupper((unsigned char)s[i]);
    }
    return resultado;
}

char* delegua_texto_minusculo(const char* s) {
    size_t tam = strlen(s);
    char* resultado = (char*)malloc(tam + 1);
    for (size_t i = 0; i <= tam; i++) {
        resultado[i] = (char)tolower((unsigned char)s[i]);
    }
    return resultado;
}

int delegua_texto_inclui(const char* s, const char* sub) {
    return strstr(s, sub) != NULL ? 1 : 0;
}

char* delegua_texto_subtexto(const char* s, int inicio, int fim) {
    int tam = (int)strlen(s);
    if (inicio < 0) inicio = 0;
    if (fim > tam) fim = tam;
    if (inicio >= fim) {
        char* vazio = (char*)malloc(1);
        vazio[0] = '\0';
        return vazio;
    }
    int tamanho = fim - inicio;
    char* resultado = (char*)malloc(tamanho + 1);
    memcpy(resultado, s + inicio, tamanho);
    resultado[tamanho] = '\0';
    return resultado;
}

char* delegua_texto_substituir(const char* s, const char* de, const char* para) {
    size_t tam_de = strlen(de);
    size_t tam_para = strlen(para);

    if (tam_de == 0) {
        size_t tam = strlen(s);
        char* copia = (char*)malloc(tam + 1);
        memcpy(copia, s, tam + 1);
        return copia;
    }

    // Contar ocorrências de 'de' em 's'
    size_t contagem = 0;
    const char* pos = s;
    while ((pos = strstr(pos, de)) != NULL) {
        contagem++;
        pos += tam_de;
    }

    size_t tam_s = strlen(s);
    size_t tam_resultado;
    if (tam_para >= tam_de) {
        tam_resultado = tam_s + contagem * (tam_para - tam_de);
    } else {
        tam_resultado = tam_s - contagem * (tam_de - tam_para);
    }

    char* resultado = (char*)malloc(tam_resultado + 1);
    char* dest = resultado;
    const char* src = s;
    while ((pos = strstr(src, de)) != NULL) {
        size_t parte = pos - src;
        memcpy(dest, src, parte);
        dest += parte;
        memcpy(dest, para, tam_para);
        dest += tam_para;
        src = pos + tam_de;
    }
    strcpy(dest, src);
    return resultado;
}

// ───────────────────────────────────────────────────────────
// Aparar, dividir, buscar
// ───────────────────────────────────────────────────────────

static char* copiar_trecho(const char* inicio, size_t tamanho) {
    char* resultado = (char*)malloc(tamanho + 1);
    if (!resultado) return NULL;
    memcpy(resultado, inicio, tamanho);
    resultado[tamanho] = '\0';
    return resultado;
}

static char* aparar(const char* s, int noInicio, int noFim) {
    if (!s) return copiar_trecho("", 0);
    const char* inicio = s;
    const char* fim = s + strlen(s);
    if (noInicio) {
        while (inicio < fim && isspace((unsigned char)*inicio)) inicio++;
    }
    if (noFim) {
        while (fim > inicio && isspace((unsigned char)*(fim - 1))) fim--;
    }
    return copiar_trecho(inicio, (size_t)(fim - inicio));
}

char* delegua_texto_aparar(const char* s) { return aparar(s, 1, 1); }
char* delegua_texto_aparar_inicio(const char* s) { return aparar(s, 1, 0); }
char* delegua_texto_aparar_fim(const char* s) { return aparar(s, 0, 1); }

// Acrescenta `parte` a `saida`, delegando para delegua_vetor_adicionar.
static void acrescentar_parte(Vetor* saida, char* parte) {
    delegua_vetor_adicionar(saida, &parte, (int)sizeof(char*));
}

Vetor* delegua_texto_dividir(const char* s, const char* delimitador, int limite) {
    Vetor* saida = delegua_vetor_criar(0, (int)sizeof(char*));
    if (!saida || !s) return saida;
    if (!delimitador) delimitador = "";

    size_t tamDelimitador = strlen(delimitador);

    if (tamDelimitador == 0) {
        for (const char* c = s; *c; c++) {
            if (limite > 0 && saida->tamanho == limite - 1) {
                acrescentar_parte(saida, copiar_trecho(c, strlen(c)));
                return saida;
            }
            acrescentar_parte(saida, copiar_trecho(c, 1));
        }
        return saida;
    }

    const char* inicio = s;
    const char* encontrado;
    while ((limite <= 0 || saida->tamanho < limite - 1) && (encontrado = strstr(inicio, delimitador)) != NULL) {
        acrescentar_parte(saida, copiar_trecho(inicio, (size_t)(encontrado - inicio)));
        inicio = encontrado + tamDelimitador;
    }
    acrescentar_parte(saida, copiar_trecho(inicio, strlen(inicio)));
    return saida;
}

char* delegua_texto_caractere_em(const char* s, int indice) {
    if (!s || indice < 0) return copiar_trecho("", 0);
    size_t tam = strlen(s);
    if ((size_t)indice >= tam) return copiar_trecho("", 0);
    return copiar_trecho(s + indice, 1);
}

int delegua_texto_encontrar(const char* s, const char* sub, int inicio) {
    if (!s || !sub) return -1;
    int tam = (int)strlen(s);
    if (inicio < 0) inicio = 0;
    if (inicio > tam) return -1;
    const char* encontrado = strstr(s + inicio, sub);
    return encontrado ? (int)(encontrado - s) : -1;
}

int delegua_texto_encontrar_ultimo(const char* s, const char* sub) {
    if (!s || !sub) return -1;
    size_t tamSub = strlen(sub);
    size_t tam = strlen(s);
    if (tamSub > tam) return -1;
    for (size_t i = tam - tamSub + 1; i-- > 0;) {
        if (memcmp(s + i, sub, tamSub) == 0) return (int)i;
    }
    return -1;
}

int delegua_texto_comeca_com(const char* s, const char* prefixo) {
    if (!s || !prefixo) return 0;
    return strncmp(s, prefixo, strlen(prefixo)) == 0 ? 1 : 0;
}

int delegua_texto_termina_com(const char* s, const char* sufixo) {
    if (!s || !sufixo) return 0;
    size_t tam = strlen(s);
    size_t tamSufixo = strlen(sufixo);
    if (tamSufixo > tam) return 0;
    return memcmp(s + tam - tamSufixo, sufixo, tamSufixo) == 0 ? 1 : 0;
}

char* delegua_texto_concatenar(const char* a, const char* b) {
    if (!a) a = "";
    if (!b) b = "";
    size_t tamA = strlen(a);
    size_t tamB = strlen(b);
    char* resultado = (char*)malloc(tamA + tamB + 1);
    if (!resultado) return NULL;
    memcpy(resultado, a, tamA);
    memcpy(resultado + tamA, b, tamB + 1);
    return resultado;
}

char* delegua_texto_inverter(const char* s) {
    if (!s) return copiar_trecho("", 0);
    size_t tam = strlen(s);
    char* resultado = (char*)malloc(tam + 1);
    if (!resultado) return NULL;
    for (size_t i = 0; i < tam; i++) resultado[i] = s[tam - 1 - i];
    resultado[tam] = '\0';
    return resultado;
}
