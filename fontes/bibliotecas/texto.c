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
