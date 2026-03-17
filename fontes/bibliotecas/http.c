#include "http.h"
#include <curl/curl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// ── Inicialização global do libcurl (guardada) ─────────────────────────────

static int g_curl_global_inicializado = 0;
static int g_curl_global_cleanup_registrado = 0;

static void delegua_http_curl_global_cleanup(void) {
    if (g_curl_global_inicializado) {
        curl_global_cleanup();
        g_curl_global_inicializado = 0;
        g_curl_global_cleanup_registrado = 0;
    }
}

static int delegua_http_curl_global_init(void) {
    if (!g_curl_global_inicializado) {
        if (curl_global_init(CURL_GLOBAL_DEFAULT) != 0) {
            return 0; // falha na inicialização global
        }
        g_curl_global_inicializado = 1;
        if (!g_curl_global_cleanup_registrado) {
            atexit(delegua_http_curl_global_cleanup);
            g_curl_global_cleanup_registrado = 1;
        }
    }
    return 1;
}

// ── Buffer dinâmico para coletar o corpo da resposta ────────────────────────

typedef struct {
    char*  ptr;
    size_t len;
    size_t cap;
} Buffer;

static void buffer_iniciar(Buffer* b) {
    b->ptr = (char*)malloc(1);
    b->len = 0;
    b->cap = 1;
    if (b->ptr) b->ptr[0] = '\0';
}

static size_t callback_escrita(char* dados, size_t tamanho, size_t nmemb, void* userdata) {
    size_t total = tamanho * nmemb;
    Buffer* b = (Buffer*)userdata;
    size_t nova_cap = b->len + total + 1;
    if (nova_cap > b->cap) {
        while (b->cap < nova_cap) b->cap *= 2;
        char* tmp = (char*)realloc(b->ptr, b->cap);
        if (!tmp) return 0;
        b->ptr = tmp;
    }
    memcpy(b->ptr + b->len, dados, total);
    b->len += total;
    b->ptr[b->len] = '\0';
    return total;
}

// ── Utilitários internos ────────────────────────────────────────────────────

static char* concatenar_url(const char* base, const char* sufixo) {
    if (!base) base = "";
    if (!sufixo) sufixo = "";
    size_t tam = strlen(base) + strlen(sufixo) + 1;
    char* url = (char*)malloc(tam);
    if (!url) return NULL;
    snprintf(url, tam, "%s%s", base, sufixo);
    return url;
}

static RespostaHttp* alocar_resposta(int codigo, char* corpo) {
    RespostaHttp* resp = (RespostaHttp*)malloc(sizeof(RespostaHttp));
    if (!resp) return NULL;
    resp->codigo_status    = codigo;
    resp->mensagem_status  = NULL; // preenchido abaixo se necessário
    resp->dados            = corpo;
    return resp;
}

// Configura cabeçalhos no handle curl; retorna lista para liberar depois.
static struct curl_slist* aplicar_cabecalhos(CURL* handle, ClienteHttp* cliente) {
    if (!cliente || cliente->num_cabecalhos == 0) return NULL;
    struct curl_slist* lista = NULL;
    for (int i = 0; i < cliente->num_cabecalhos; i++) {
        lista = curl_slist_append(lista, cliente->cabecalhos[i]);
    }
    curl_easy_setopt(handle, CURLOPT_HTTPHEADER, lista);
    return lista;
}

// Executa a requisição já configurada no handle.
static RespostaHttp* executar(CURL* handle, ClienteHttp* cliente) {
    Buffer buf;
    buffer_iniciar(&buf);
    curl_easy_setopt(handle, CURLOPT_WRITEFUNCTION, callback_escrita);
    curl_easy_setopt(handle, CURLOPT_WRITEDATA, &buf);
    curl_easy_setopt(handle, CURLOPT_FOLLOWLOCATION, 1L);
    if (cliente && cliente->tempo_maximo_ms > 0) {
        curl_easy_setopt(handle, CURLOPT_TIMEOUT_MS, cliente->tempo_maximo_ms);
    } else {
        curl_easy_setopt(handle, CURLOPT_TIMEOUT_MS, 30000L);
    }

    struct curl_slist* lista_cab = aplicar_cabecalhos(handle, cliente);
    CURLcode res = curl_easy_perform(handle);

    long codigo = 0;
    if (res == CURLE_OK) {
        curl_easy_getinfo(handle, CURLINFO_RESPONSE_CODE, &codigo);
    }

    if (lista_cab) curl_slist_free_all(lista_cab);
    curl_easy_cleanup(handle);

    if (res != CURLE_OK) {
        free(buf.ptr);
        return NULL;
    }
    return alocar_resposta((int)codigo, buf.ptr);
}

// ── Funções públicas ────────────────────────────────────────────────────────

ClienteHttp* delegua_http_novo_cliente(char* url_base, int tempo_ms) {
    ClienteHttp* cliente = (ClienteHttp*)calloc(1, sizeof(ClienteHttp));
    if (!cliente) return NULL;
    cliente->url_base       = url_base ? strdup(url_base) : NULL;
    cliente->tempo_maximo_ms = tempo_ms > 0 ? (long)tempo_ms : 30000L;
    cliente->cabecalhos     = NULL;
    cliente->num_cabecalhos = 0;
    return cliente;
}

void delegua_http_add_cabecalho(ClienteHttp* cliente, char* cabecalho) {
    if (!cliente || !cabecalho) return;
    int n = cliente->num_cabecalhos;
    char** tmp = (char**)realloc(cliente->cabecalhos, (n + 1) * sizeof(char*));
    if (!tmp) return;
    tmp[n] = strdup(cabecalho);
    cliente->cabecalhos      = tmp;
    cliente->num_cabecalhos  = n + 1;
}

RespostaHttp* delegua_http_get(ClienteHttp* cliente, char* sufixo) {
    if (!delegua_http_curl_global_init()) {
        return NULL;
    }
    CURL* handle = curl_easy_init();
    if (!handle) return NULL;
    char* url = concatenar_url(cliente ? cliente->url_base : "", sufixo);
    if (!url) {
        curl_easy_cleanup(handle);
        return NULL;
    }
    curl_easy_setopt(handle, CURLOPT_URL, url);
    RespostaHttp* resp = executar(handle, cliente);
    free(url);
    return resp;
}

RespostaHttp* delegua_http_post(ClienteHttp* cliente, char* sufixo, char* corpo) {
    if (!delegua_http_curl_global_init()) {
        return NULL;
    }
    CURL* handle = curl_easy_init();
    if (!handle) return NULL;
    char* url = concatenar_url(cliente ? cliente->url_base : "", sufixo);
    if (!url) {
        curl_easy_cleanup(handle);
        return NULL;
    }
    curl_easy_setopt(handle, CURLOPT_URL, url);
    curl_easy_setopt(handle, CURLOPT_POST, 1L);
    curl_easy_setopt(handle, CURLOPT_POSTFIELDS, corpo ? corpo : "");
    RespostaHttp* resp = executar(handle, cliente);
    free(url);
    return resp;
}

RespostaHttp* delegua_http_put(ClienteHttp* cliente, char* sufixo, char* corpo) {
    if (!delegua_http_curl_global_init()) {
        return NULL;
    }
    CURL* handle = curl_easy_init();
    if (!handle) return NULL;
    char* url = concatenar_url(cliente ? cliente->url_base : "", sufixo);
    if (!url) {
        curl_easy_cleanup(handle);
        return NULL;
    }
    curl_easy_setopt(handle, CURLOPT_URL, url);
    curl_easy_setopt(handle, CURLOPT_CUSTOMREQUEST, "PUT");
    curl_easy_setopt(handle, CURLOPT_POSTFIELDS, corpo ? corpo : "");
    RespostaHttp* resp = executar(handle, cliente);
    free(url);
    return resp;
}

RespostaHttp* delegua_http_delete(ClienteHttp* cliente, char* sufixo) {
    CURL* handle = curl_easy_init();
    if (!handle) return NULL;
    char* url = concatenar_url(cliente ? cliente->url_base : "", sufixo);
    curl_easy_setopt(handle, CURLOPT_URL, url);
    curl_easy_setopt(handle, CURLOPT_CUSTOMREQUEST, "DELETE");
    RespostaHttp* resp = executar(handle, cliente);
    free(url);
    return resp;
}

RespostaHttp* delegua_http_patch(ClienteHttp* cliente, char* sufixo, char* corpo) {
    CURL* handle = curl_easy_init();
    if (!handle) return NULL;
    char* url = concatenar_url(cliente ? cliente->url_base : "", sufixo);
    curl_easy_setopt(handle, CURLOPT_URL, url);
    curl_easy_setopt(handle, CURLOPT_CUSTOMREQUEST, "PATCH");
    curl_easy_setopt(handle, CURLOPT_POSTFIELDS, corpo ? corpo : "");
    RespostaHttp* resp = executar(handle, cliente);
    free(url);
    return resp;
}

int delegua_http_codigo_status(RespostaHttp* resp) {
    return resp ? resp->codigo_status : 0;
}

char* delegua_http_dados(RespostaHttp* resp) {
    return resp ? resp->dados : NULL;
}

char* delegua_http_mensagem(RespostaHttp* resp) {
    return resp ? resp->mensagem_status : NULL;
}

void delegua_http_liberar_resp(RespostaHttp* resp) {
    if (!resp) return;
    free(resp->dados);
    free(resp->mensagem_status);
    free(resp);
}

void delegua_http_liberar_cliente(ClienteHttp* cliente) {
    if (!cliente) return;
    free(cliente->url_base);
    for (int i = 0; i < cliente->num_cabecalhos; i++) free(cliente->cabecalhos[i]);
    free(cliente->cabecalhos);
    free(cliente);
}
