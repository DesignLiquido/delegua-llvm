#include "arquivos.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifdef _WIN32
    #include <windows.h>
    #include <direct.h>
    #include <io.h>
    #include <sys/stat.h>
    #define delegua_getcwd _getcwd
    #define delegua_stat   _stat
    #define delegua_stat_s struct _stat
    #define S_ISREG(m) (((m) & _S_IFMT) == _S_IFREG)
    #define S_ISDIR(m) (((m) & _S_IFMT) == _S_IFDIR)
#else
    #include <dirent.h>
    #include <errno.h>
    #include <limits.h>
    #include <pwd.h>
    #include <unistd.h>
    #include <sys/stat.h>
    #include <sys/types.h>
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

// ── Sistema de arquivos ─────────────────────────────────────────────────────

static char* duplicar_texto(const char* texto) {
    if (!texto) return NULL;
    size_t tamanho = strlen(texto);
    char* copia = (char*)malloc(tamanho + 1);
    if (copia) memcpy(copia, texto, tamanho + 1);
    return copia;
}

static int eh_separador(char c) {
#ifdef _WIN32
    return c == '/' || c == '\\';
#else
    return c == '/';
#endif
}

int delegua_arq_existe(char* caminho) {
    if (!caminho || !*caminho) return 0;
    delegua_stat_s info;
    return delegua_stat(caminho, &info) == 0 ? 1 : 0;
}

static int criar_um_diretorio(const char* caminho) {
#ifdef _WIN32
    if (_mkdir(caminho) == 0) return 1;
#else
    if (mkdir(caminho, 0755) == 0) return 1;
#endif
    return delegua_arq_diretorio_existe((char*)caminho);
}

int delegua_arq_criar_diretorio(char* caminho) {
    if (!caminho || !*caminho) return 0;
    if (delegua_arq_diretorio_existe(caminho)) return 1;

    char* copia = duplicar_texto(caminho);
    if (!copia) return 0;
    size_t tamanho = strlen(copia);
    while (tamanho > 1 && eh_separador(copia[tamanho - 1])) copia[--tamanho] = '\0';

    // Cria cada prefixo do caminho, pulando a raiz ("/" ou "C:\").
    for (size_t i = 1; i < tamanho; i++) {
        if (!eh_separador(copia[i])) continue;
        if (i == 2 && copia[1] == ':') continue;
        char original = copia[i];
        copia[i] = '\0';
        if (!delegua_arq_diretorio_existe(copia)) criar_um_diretorio(copia);
        copia[i] = original;
    }
    int resultado = criar_um_diretorio(copia);
    free(copia);
    return resultado;
}

int delegua_arq_remover(char* caminho) {
    if (!caminho || !*caminho) return 0;
#ifdef _WIN32
    DWORD atributos = GetFileAttributesA(caminho);
    if (atributos == INVALID_FILE_ATTRIBUTES) return 1;
    // Arquivos somente leitura (ex.: objetos do .git) precisam perder o atributo antes.
    if (atributos & FILE_ATTRIBUTE_READONLY) {
        SetFileAttributesA(caminho, atributos & ~FILE_ATTRIBUTE_READONLY);
    }
    // Junções e links simbólicos são removidos sem seguir o destino.
    if (atributos & FILE_ATTRIBUTE_REPARSE_POINT) {
        if (atributos & FILE_ATTRIBUTE_DIRECTORY) return RemoveDirectoryA(caminho) ? 1 : 0;
        return DeleteFileA(caminho) ? 1 : 0;
    }
    if (!(atributos & FILE_ATTRIBUTE_DIRECTORY)) return DeleteFileA(caminho) ? 1 : 0;

    char* padrao = delegua_arq_juntar_caminhos(caminho, "*");
    WIN32_FIND_DATAA dados;
    HANDLE busca = FindFirstFileA(padrao, &dados);
    free(padrao);
    int sucesso = 1;
    if (busca != INVALID_HANDLE_VALUE) {
        do {
            if (strcmp(dados.cFileName, ".") == 0 || strcmp(dados.cFileName, "..") == 0) continue;
            char* filho = delegua_arq_juntar_caminhos(caminho, dados.cFileName);
            if (!delegua_arq_remover(filho)) sucesso = 0;
            free(filho);
        } while (FindNextFileA(busca, &dados));
        FindClose(busca);
    }
    if (!RemoveDirectoryA(caminho)) sucesso = 0;
    return sucesso;
#else
    struct stat info;
    if (lstat(caminho, &info) != 0) return errno == ENOENT ? 1 : 0;
    // Links simbólicos são removidos sem seguir o destino.
    if (!S_ISDIR(info.st_mode)) return unlink(caminho) == 0 ? 1 : 0;

    DIR* diretorio = opendir(caminho);
    int sucesso = 1;
    if (diretorio) {
        struct dirent* entrada;
        while ((entrada = readdir(diretorio)) != NULL) {
            if (strcmp(entrada->d_name, ".") == 0 || strcmp(entrada->d_name, "..") == 0) continue;
            char* filho = delegua_arq_juntar_caminhos(caminho, entrada->d_name);
            if (!delegua_arq_remover(filho)) sucesso = 0;
            free(filho);
        }
        closedir(diretorio);
    }
    if (rmdir(caminho) != 0) sucesso = 0;
    return sucesso;
#endif
}

int delegua_arq_renomear(char* origem, char* destino) {
    if (!origem || !destino) return 0;
#ifdef _WIN32
    DWORD atributos = GetFileAttributesA(origem);
    if (atributos == INVALID_FILE_ATTRIBUTES) return 0;
    // MOVEFILE_REPLACE_EXISTING não pode ser usado com diretórios.
    DWORD opcoes = (atributos & FILE_ATTRIBUTE_DIRECTORY) ? 0 : (MOVEFILE_REPLACE_EXISTING | MOVEFILE_COPY_ALLOWED);
    return MoveFileExA(origem, destino, opcoes) ? 1 : 0;
#else
    return rename(origem, destino) == 0 ? 1 : 0;
#endif
}

static int comparar_textos(const void* a, const void* b) {
    return strcmp(*(const char* const*)a, *(const char* const*)b);
}

static void acrescentar_nome(Vetor* vetor, int* capacidade, const char* nome) {
    if (vetor->tamanho >= *capacidade) {
        int nova = *capacidade ? *capacidade * 2 : 16;
        void* novos = realloc(vetor->ptr, (size_t)nova * sizeof(char*));
        if (!novos) return;
        vetor->ptr = novos;
        *capacidade = nova;
    }
    ((char**)vetor->ptr)[vetor->tamanho++] = duplicar_texto(nome);
}

Vetor* delegua_arq_listar_diretorio(char* caminho) {
    Vetor* vetor = (Vetor*)malloc(sizeof(Vetor));
    if (!vetor) return NULL;
    vetor->ptr = NULL;
    vetor->tamanho = 0;
    if (!caminho || !*caminho) return vetor;
    int capacidade = 0;

#ifdef _WIN32
    char* padrao = delegua_arq_juntar_caminhos(caminho, "*");
    WIN32_FIND_DATAA dados;
    HANDLE busca = FindFirstFileA(padrao, &dados);
    free(padrao);
    if (busca != INVALID_HANDLE_VALUE) {
        do {
            if (strcmp(dados.cFileName, ".") == 0 || strcmp(dados.cFileName, "..") == 0) continue;
            acrescentar_nome(vetor, &capacidade, dados.cFileName);
        } while (FindNextFileA(busca, &dados));
        FindClose(busca);
    }
#else
    DIR* diretorio = opendir(caminho);
    if (diretorio) {
        struct dirent* entrada;
        while ((entrada = readdir(diretorio)) != NULL) {
            if (strcmp(entrada->d_name, ".") == 0 || strcmp(entrada->d_name, "..") == 0) continue;
            acrescentar_nome(vetor, &capacidade, entrada->d_name);
        }
        closedir(diretorio);
    }
#endif

    if (vetor->tamanho > 1) qsort(vetor->ptr, (size_t)vetor->tamanho, sizeof(char*), comparar_textos);
    return vetor;
}

char* delegua_arq_criar_diretorio_temporario(char* pai, char* prefixo) {
    const char* base = pai;
    char temporarioSistema[4096];
    if (!base || !*base) {
#ifdef _WIN32
        DWORD tamanho = GetTempPathA(sizeof(temporarioSistema), temporarioSistema);
        if (tamanho == 0 || tamanho >= sizeof(temporarioSistema)) return NULL;
#else
        const char* tmp = getenv("TMPDIR");
        snprintf(temporarioSistema, sizeof(temporarioSistema), "%s", (tmp && *tmp) ? tmp : "/tmp");
#endif
        base = temporarioSistema;
    }
    const char* inicio = (prefixo && *prefixo) ? prefixo : "delegua-";

    char nome[512];
#ifdef _WIN32
    for (int tentativa = 0; tentativa < 100; tentativa++) {
        snprintf(nome, sizeof(nome), "%s%08lx%04x", inicio,
                 (unsigned long)(GetTickCount64() ^ ((unsigned long long)GetCurrentProcessId() << 16)),
                 (unsigned)((rand() ^ tentativa) & 0xffff));
        char* caminho = delegua_arq_juntar_caminhos((char*)base, nome);
        if (caminho && _mkdir(caminho) == 0) return caminho;
        free(caminho);
    }
    return NULL;
#else
    snprintf(nome, sizeof(nome), "%sXXXXXX", inicio);
    char* modelo = delegua_arq_juntar_caminhos((char*)base, nome);
    if (!modelo) return NULL;
    if (!mkdtemp(modelo)) {
        free(modelo);
        return NULL;
    }
    return modelo;
#endif
}

char* delegua_arq_diretorio_pessoal(void) {
#ifdef _WIN32
    const char* perfil = getenv("USERPROFILE");
    if (perfil && *perfil) return duplicar_texto(perfil);
    const char* unidade = getenv("HOMEDRIVE");
    const char* caminho = getenv("HOMEPATH");
    if (unidade && caminho) {
        size_t tamanhoUnidade = strlen(unidade);
        size_t tamanhoCaminho = strlen(caminho);
        char* resultado = (char*)malloc(tamanhoUnidade + tamanhoCaminho + 1);
        if (resultado) {
            memcpy(resultado, unidade, tamanhoUnidade);
            memcpy(resultado + tamanhoUnidade, caminho, tamanhoCaminho + 1);
        }
        return resultado;
    }
    return NULL;
#else
    const char* casa = getenv("HOME");
    if (casa && *casa) return duplicar_texto(casa);
    struct passwd* usuario = getpwuid(getuid());
    return usuario ? duplicar_texto(usuario->pw_dir) : NULL;
#endif
}

char* delegua_arq_ler_texto(char* caminho) {
    if (!caminho) return NULL;
    FILE* fp = fopen(caminho, "rb");
    if (!fp) return NULL;
    fseek(fp, 0, SEEK_END);
    long tamanho = ftell(fp);
    rewind(fp);
    if (tamanho < 0) {
        fclose(fp);
        return NULL;
    }
    char* conteudo = (char*)malloc((size_t)tamanho + 1);
    if (!conteudo) {
        fclose(fp);
        return NULL;
    }
    size_t lidos = fread(conteudo, 1, (size_t)tamanho, fp);
    conteudo[lidos] = '\0';
    fclose(fp);
    return conteudo;
}

int delegua_arq_escrever_texto(char* caminho, char* conteudo) {
    if (!caminho) return 0;
    FILE* fp = fopen(caminho, "wb");
    if (!fp) return 0;
    size_t tamanho = conteudo ? strlen(conteudo) : 0;
    size_t escritos = tamanho ? fwrite(conteudo, 1, tamanho, fp) : 0;
    int fechou = fclose(fp) == 0;
    return (escritos == tamanho && fechou) ? 1 : 0;
}

int delegua_arq_definir_permissoes(char* caminho, int modo) {
    if (!caminho) return 0;
#ifdef _WIN32
    // Sem permissão de escrita para o dono (0200) = somente leitura.
    return _chmod(caminho, (modo & 0200) ? (_S_IREAD | _S_IWRITE) : _S_IREAD) == 0 ? 1 : 0;
#else
    return chmod(caminho, (mode_t)modo) == 0 ? 1 : 0;
#endif
}

// ── Caminhos ────────────────────────────────────────────────────────────────

char* delegua_arq_juntar_caminhos(char* base, char* parte) {
    if (!base || !*base) return duplicar_texto(parte ? parte : "");
    if (!parte || !*parte) return duplicar_texto(base);
#ifdef _WIN32
    const char separador = '\\';
    int parteAbsoluta = eh_separador(parte[0]) || parte[1] == ':';
#else
    const char separador = '/';
    int parteAbsoluta = parte[0] == '/';
#endif
    if (parteAbsoluta) return duplicar_texto(parte);

    size_t tamanhoBase = strlen(base);
    size_t tamanhoParte = strlen(parte);
    int precisaSeparador = !eh_separador(base[tamanhoBase - 1]);
    char* resultado = (char*)malloc(tamanhoBase + (size_t)precisaSeparador + tamanhoParte + 1);
    if (!resultado) return NULL;
    memcpy(resultado, base, tamanhoBase);
    size_t posicao = tamanhoBase;
    if (precisaSeparador) resultado[posicao++] = separador;
    memcpy(resultado + posicao, parte, tamanhoParte + 1);
    return resultado;
}

char* delegua_arq_diretorio_pai(char* caminho) {
    if (!caminho || !*caminho) return duplicar_texto(".");
    char* copia = duplicar_texto(caminho);
    if (!copia) return NULL;
    size_t tamanho = strlen(copia);
    while (tamanho > 1 && eh_separador(copia[tamanho - 1])) tamanho--;
    while (tamanho > 0 && !eh_separador(copia[tamanho - 1])) tamanho--;
    if (tamanho == 0) {
        free(copia);
        return duplicar_texto(".");
    }
    // Remove o separador final, mas mantém a raiz ("/" ou "C:\").
    while (tamanho > 1 && eh_separador(copia[tamanho - 1]) && !(tamanho == 3 && copia[1] == ':')) tamanho--;
    copia[tamanho] = '\0';
    return copia;
}

char* delegua_arq_nome_base(char* caminho) {
    if (!caminho || !*caminho) return duplicar_texto("");
    size_t tamanho = strlen(caminho);
    while (tamanho > 1 && eh_separador(caminho[tamanho - 1])) tamanho--;
    size_t inicio = tamanho;
    while (inicio > 0 && !eh_separador(caminho[inicio - 1])) inicio--;
    char* resultado = (char*)malloc(tamanho - inicio + 1);
    if (!resultado) return NULL;
    memcpy(resultado, caminho + inicio, tamanho - inicio);
    resultado[tamanho - inicio] = '\0';
    return resultado;
}

char* delegua_arq_caminho_absoluto(char* caminho) {
    if (!caminho) return NULL;
#ifdef _WIN32
    char* resultado = _fullpath(NULL, caminho, 0);
    return resultado ? resultado : duplicar_texto(caminho);
#else
    char resolvido[PATH_MAX];
    if (realpath(caminho, resolvido)) return duplicar_texto(resolvido);
    if (caminho[0] == '/') return duplicar_texto(caminho);
    char* atual = delegua_arq_diretorio_atual();
    char* resultado = delegua_arq_juntar_caminhos(atual, caminho);
    free(atual);
    return resultado;
#endif
}
