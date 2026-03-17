#include "arquivos.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifdef _WIN32
    #include <direct.h>
    #include <io.h>
    #include <sys/stat.h>
    #define delegua_getcwd _getcwd
    #define delegua_stat   _stat
    #define delegua_stat_s struct _stat
    #define S_ISREG(m) (((m) & _S_IFMT) == _S_IFREG)
    #define S_ISDIR(m) (((m) & _S_IFMT) == _S_IFDIR)
#else
    #include <unistd.h>
    #include <sys/stat.h>
    #define delegua_getcwd getcwd
    #define delegua_stat   stat
    #define delegua_stat_s struct stat
#endif

// ── Funções de módulo (livres) ──────────────────────────────────────────────

Arquivo* delegua_arq_abrir(char* caminho) {
    FILE* fp = fopen(caminho, "rb");
    if (!fp) return NULL;

    fseek(fp, 0, SEEK_END);
    long tamanho = ftell(fp);
    rewind(fp);

    char* conteudo = (char*)malloc(tamanho + 1);
    if (!conteudo) { fclose(fp); return NULL; }
    fread(conteudo, 1, tamanho, fp);
    conteudo[tamanho] = '\0';
    fclose(fp);

    Arquivo* arq = (Arquivo*)malloc(sizeof(Arquivo));
    if (!arq) { free(conteudo); return NULL; }
    arq->caminho  = strdup(caminho);
    arq->conteudo = conteudo;
    arq->tamanho  = tamanho;
    return arq;
}

char* delegua_arq_diretorio_atual(void) {
    char* buffer = (char*)malloc(4096);
    if (!buffer) return NULL;
    if (!delegua_getcwd(buffer, 4096)) { free(buffer); return NULL; }
    return buffer;
}

int delegua_arq_diretorio_existe(char* caminho) {
    delegua_stat_s info;
    if (delegua_stat(caminho, &info) != 0) return 0;
    return S_ISDIR(info.st_mode) ? 1 : 0;
}

int delegua_arq_e_arquivo(char* caminho) {
    delegua_stat_s info;
    if (delegua_stat(caminho, &info) != 0) return 0;
    return S_ISREG(info.st_mode) ? 1 : 0;
}

int delegua_arq_e_diretorio(char* caminho) {
    return delegua_arq_diretorio_existe(caminho);
}

// ── Funções de instância (recebem Arquivo*) ─────────────────────────────────

char* delegua_arq_para_texto(Arquivo* arq) {
    if (!arq) return NULL;
    return arq->conteudo;
}

void delegua_arq_escrever(Arquivo* arq, char* texto) {
    if (!arq || !texto) return;
    FILE* fp = fopen(arq->caminho, "a");
    if (!fp) return;
    fputs(texto, fp);
    fclose(fp);
}

void delegua_arq_sobrescrever(Arquivo* arq, char* texto) {
    if (!arq || !texto) return;
    FILE* fp = fopen(arq->caminho, "w");
    if (!fp) return;
    fputs(texto, fp);
    fclose(fp);
}

void delegua_arq_recarregar(Arquivo* arq) {
    if (!arq || !arq->caminho) return;
    FILE* fp = fopen(arq->caminho, "rb");
    if (!fp) return;

    fseek(fp, 0, SEEK_END);
    long tamanho = ftell(fp);
    rewind(fp);

    char* novo = (char*)malloc(tamanho + 1);
    if (!novo) { fclose(fp); return; }
    fread(novo, 1, tamanho, fp);
    novo[tamanho] = '\0';
    fclose(fp);

    free(arq->conteudo);
    arq->conteudo = novo;
    arq->tamanho  = tamanho;
}

int delegua_arq_instancia_e_arquivo(Arquivo* arq) {
    if (!arq || !arq->caminho) return 0;
    return delegua_arq_e_arquivo(arq->caminho);
}

int delegua_arq_instancia_e_diretorio(Arquivo* arq) {
    if (!arq || !arq->caminho) return 0;
    return delegua_arq_e_diretorio(arq->caminho);
}
