#include "http.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Cliente HTTP do módulo `http`. A requisição em si fica em executar_requisicao(), que tem
// duas implementações:
//   - Windows: WinHTTP, que faz parte do sistema (HTTPS pelo Schannel), então os binários
//     não dependem de nenhuma biblioteca instalada;
//   - demais sistemas: libcurl.
// O restante (cliente, cabeçalhos, respostas) é comum às duas.

// ── Buffer dinâmico para coletar o corpo da resposta ────────────────────────

typedef struct {
    char*  ptr;
    size_t len;
    size_t cap;
} Buffer;

static int buffer_iniciar(Buffer* b) {
    b->ptr = (char*)malloc(1);
    b->len = 0;
    b->cap = 1;
    if (!b->ptr) return 0;
    b->ptr[0] = '\0';
    return 1;
}

static int buffer_acrescentar(Buffer* b, const char* dados, size_t total) {
    size_t nova_cap = b->len + total + 1;
    if (nova_cap > b->cap) {
        size_t cap = b->cap;
        while (cap < nova_cap) cap *= 2;
        char* tmp = (char*)realloc(b->ptr, cap);
        if (!tmp) return 0;
        b->ptr = tmp;
        b->cap = cap;
    }
    memcpy(b->ptr + b->len, dados, total);
    b->len += total;
    b->ptr[b->len] = '\0';
    return 1;
}

// ── Utilitários comuns ──────────────────────────────────────────────────────

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
    if (!resp) {
        free(corpo);
        return NULL;
    }
    resp->codigo_status   = codigo;
    resp->mensagem_status = NULL;
    resp->dados           = corpo;
    return resp;
}

static long tempo_maximo(ClienteHttp* cliente) {
    return (cliente && cliente->tempo_maximo_ms > 0) ? cliente->tempo_maximo_ms : 30000L;
}

// Executa `metodo` em `url`; `corpo` é NULL para requisições sem corpo. Retorna NULL em
// falha de rede (servidor inacessível, tempo esgotado, erro de TLS...).
static RespostaHttp* executar_requisicao(ClienteHttp* cliente, const char* metodo, const char* url, const char* corpo);

#ifdef _WIN32

// ── Implementação com WinHTTP ───────────────────────────────────────────────

#include <windows.h>
#include <winhttp.h>

// UTF-8 → UTF-16 (alocado; NULL em falha).
static wchar_t* para_utf16(const char* texto) {
    if (!texto) texto = "";
    int tamanho = MultiByteToWideChar(CP_UTF8, 0, texto, -1, NULL, 0);
    if (tamanho <= 0) return NULL;
    wchar_t* largo = (wchar_t*)malloc((size_t)tamanho * sizeof(wchar_t));
    if (!largo) return NULL;
    if (MultiByteToWideChar(CP_UTF8, 0, texto, -1, largo, tamanho) <= 0) {
        free(largo);
        return NULL;
    }
    return largo;
}

static int tem_cabecalho(ClienteHttp* cliente, const char* nome) {
    size_t tamanho_nome = strlen(nome);
    for (int i = 0; cliente && i < cliente->num_cabecalhos; i++) {
        const char* cabecalho = cliente->cabecalhos[i];
        if (_strnicmp(cabecalho, nome, tamanho_nome) == 0 && cabecalho[tamanho_nome] == ':') return 1;
    }
    return 0;
}

// Cabeçalhos do cliente separados por "\r\n". Como o libcurl, uma requisição com corpo e
// sem Content-Type recebe "application/x-www-form-urlencoded".
static char* montar_cabecalhos(ClienteHttp* cliente, int tem_corpo) {
    Buffer b;
    if (!buffer_iniciar(&b)) return NULL;
    for (int i = 0; cliente && i < cliente->num_cabecalhos; i++) {
        if (!buffer_acrescentar(&b, cliente->cabecalhos[i], strlen(cliente->cabecalhos[i])) ||
            !buffer_acrescentar(&b, "\r\n", 2)) {
            free(b.ptr);
            return NULL;
        }
    }
    if (tem_corpo && !tem_cabecalho(cliente, "Content-Type")) {
        const char* padrao = "Content-Type: application/x-www-form-urlencoded\r\n";
        if (!buffer_acrescentar(&b, padrao, strlen(padrao))) {
            free(b.ptr);
            return NULL;
        }
    }
    return b.ptr;
}

static RespostaHttp* executar_requisicao(ClienteHttp* cliente, const char* metodo, const char* url, const char* corpo) {
    RespostaHttp* resposta = NULL;
    HINTERNET sessao = NULL, conexao = NULL, requisicao = NULL;
    wchar_t* url_larga = para_utf16(url);
    wchar_t* metodo_largo = para_utf16(metodo);
    wchar_t* host = NULL;
    wchar_t* caminho = NULL;
    wchar_t* cabecalhos_largos = NULL;
    char* cabecalhos = NULL;
    Buffer corpo_resposta = {0};

    if (!url_larga || !metodo_largo) goto fim;

    URL_COMPONENTS partes;
    memset(&partes, 0, sizeof(partes));
    partes.dwStructSize = sizeof(partes);
    partes.dwSchemeLength = (DWORD)-1;
    partes.dwHostNameLength = (DWORD)-1;
    partes.dwUrlPathLength = (DWORD)-1;
    partes.dwExtraInfoLength = (DWORD)-1;
    if (!WinHttpCrackUrl(url_larga, 0, 0, &partes)) goto fim;
    if (partes.nScheme != INTERNET_SCHEME_HTTP && partes.nScheme != INTERNET_SCHEME_HTTPS) goto fim;

    host = (wchar_t*)calloc(partes.dwHostNameLength + 1, sizeof(wchar_t));
    caminho = (wchar_t*)calloc(partes.dwUrlPathLength + partes.dwExtraInfoLength + 2, sizeof(wchar_t));
    if (!host || !caminho) goto fim;
    // calloc: as cópias já terminam em zero.
    memcpy(host, partes.lpszHostName, partes.dwHostNameLength * sizeof(wchar_t));
    size_t posicao = 0;
    if (partes.dwUrlPathLength > 0) {
        memcpy(caminho, partes.lpszUrlPath, partes.dwUrlPathLength * sizeof(wchar_t));
        posicao = partes.dwUrlPathLength;
    } else {
        caminho[posicao++] = L'/';
    }
    if (partes.dwExtraInfoLength > 0) {
        memcpy(caminho + posicao, partes.lpszExtraInfo, partes.dwExtraInfoLength * sizeof(wchar_t));
    }

    sessao = WinHttpOpen(L"delegua-llvm", WINHTTP_ACCESS_TYPE_DEFAULT_PROXY, WINHTTP_NO_PROXY_NAME,
                         WINHTTP_NO_PROXY_BYPASS, 0);
    if (!sessao) goto fim;
    int tempo = (int)tempo_maximo(cliente);
    WinHttpSetTimeouts(sessao, tempo, tempo, tempo, tempo);

    conexao = WinHttpConnect(sessao, host, partes.nPort, 0);
    if (!conexao) goto fim;

    DWORD bandeiras = partes.nScheme == INTERNET_SCHEME_HTTPS ? WINHTTP_FLAG_SECURE : 0;
    requisicao = WinHttpOpenRequest(conexao, metodo_largo, caminho, NULL, WINHTTP_NO_REFERER,
                                    WINHTTP_DEFAULT_ACCEPT_TYPES, bandeiras);
    if (!requisicao) goto fim;

    cabecalhos = montar_cabecalhos(cliente, corpo != NULL);
    if (!cabecalhos) goto fim;
    if (cabecalhos[0]) {
        cabecalhos_largos = para_utf16(cabecalhos);
        if (!cabecalhos_largos ||
            !WinHttpAddRequestHeaders(requisicao, cabecalhos_largos, (DWORD)-1L,
                                      WINHTTP_ADDREQ_FLAG_ADD | WINHTTP_ADDREQ_FLAG_REPLACE)) {
            goto fim;
        }
    }

    DWORD tamanho_corpo = corpo ? (DWORD)strlen(corpo) : 0;
    if (!WinHttpSendRequest(requisicao, WINHTTP_NO_ADDITIONAL_HEADERS, 0,
                            corpo ? (LPVOID)corpo : WINHTTP_NO_REQUEST_DATA, tamanho_corpo, tamanho_corpo, 0)) {
        goto fim;
    }
    if (!WinHttpReceiveResponse(requisicao, NULL)) goto fim;

    DWORD codigo = 0;
    DWORD tamanho_codigo = sizeof(codigo);
    if (!WinHttpQueryHeaders(requisicao, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
                             WINHTTP_HEADER_NAME_BY_INDEX, &codigo, &tamanho_codigo, WINHTTP_NO_HEADER_INDEX)) {
        goto fim;
    }

    if (!buffer_iniciar(&corpo_resposta)) goto fim;
    for (;;) {
        DWORD disponivel = 0;
        if (!WinHttpQueryDataAvailable(requisicao, &disponivel)) goto fim;
        if (disponivel == 0) break;
        char* pedaco = (char*)malloc(disponivel);
        if (!pedaco) goto fim;
        DWORD lidos = 0;
        int ok = WinHttpReadData(requisicao, pedaco, disponivel, &lidos) &&
                 buffer_acrescentar(&corpo_resposta, pedaco, lidos);
        free(pedaco);
        if (!ok) goto fim;
        if (lidos == 0) break;
    }

    resposta = alocar_resposta((int)codigo, corpo_resposta.ptr);
    corpo_resposta.ptr = NULL;

fim:
    free(corpo_resposta.ptr);
    if (requisicao) WinHttpCloseHandle(requisicao);
    if (conexao) WinHttpCloseHandle(conexao);
    if (sessao) WinHttpCloseHandle(sessao);
    free(cabecalhos_largos);
    free(cabecalhos);
    free(caminho);
    free(host);
    free(metodo_largo);
    free(url_larga);
    return resposta;
}

#else

// ── Implementação com libcurl ───────────────────────────────────────────────

#include <curl/curl.h>

static int g_curl_global_inicializado = 0;

static void delegua_http_curl_global_cleanup(void) {
    if (g_curl_global_inicializado) {
        curl_global_cleanup();
        g_curl_global_inicializado = 0;
    }
}

static int delegua_http_curl_global_init(void) {
    if (!g_curl_global_inicializado) {
        if (curl_global_init(CURL_GLOBAL_DEFAULT) != 0) return 0;
        g_curl_global_inicializado = 1;
        atexit(delegua_http_curl_global_cleanup);
    }
    return 1;
}

static size_t callback_escrita(char* dados, size_t tamanho, size_t nmemb, void* userdata) {
    size_t total = tamanho * nmemb;
    return buffer_acrescentar((Buffer*)userdata, dados, total) ? total : 0;
}

static RespostaHttp* executar_requisicao(ClienteHttp* cliente, const char* metodo, const char* url, const char* corpo) {
    if (!delegua_http_curl_global_init()) return NULL;
    CURL* handle = curl_easy_init();
    if (!handle) return NULL;

    Buffer buf;
    if (!buffer_iniciar(&buf)) {
        curl_easy_cleanup(handle);
        return NULL;
    }

    curl_easy_setopt(handle, CURLOPT_URL, url);
    if (strcmp(metodo, "POST") == 0) {
        curl_easy_setopt(handle, CURLOPT_POST, 1L);
    } else if (strcmp(metodo, "GET") != 0) {
        curl_easy_setopt(handle, CURLOPT_CUSTOMREQUEST, metodo);
    }
    if (corpo) curl_easy_setopt(handle, CURLOPT_POSTFIELDS, corpo);
    curl_easy_setopt(handle, CURLOPT_WRITEFUNCTION, callback_escrita);
    curl_easy_setopt(handle, CURLOPT_WRITEDATA, &buf);
    curl_easy_setopt(handle, CURLOPT_FOLLOWLOCATION, 1L);
    curl_easy_setopt(handle, CURLOPT_TIMEOUT_MS, tempo_maximo(cliente));

    struct curl_slist* lista = NULL;
    for (int i = 0; cliente && i < cliente->num_cabecalhos; i++) {
        lista = curl_slist_append(lista, cliente->cabecalhos[i]);
    }
    if (lista) curl_easy_setopt(handle, CURLOPT_HTTPHEADER, lista);

    CURLcode res = curl_easy_perform(handle);
    long codigo = 0;
    if (res == CURLE_OK) curl_easy_getinfo(handle, CURLINFO_RESPONSE_CODE, &codigo);

    if (lista) curl_slist_free_all(lista);
    curl_easy_cleanup(handle);

    if (res != CURLE_OK) {
        free(buf.ptr);
        return NULL;
    }
    return alocar_resposta((int)codigo, buf.ptr);
}

#endif

static RespostaHttp* requisitar(ClienteHttp* cliente, const char* metodo, char* sufixo, const char* corpo) {
    char* url = concatenar_url(cliente ? cliente->url_base : "", sufixo);
    if (!url) return NULL;
    RespostaHttp* resp = executar_requisicao(cliente, metodo, url, corpo);
    free(url);
    return resp;
}

// ── Funções públicas ────────────────────────────────────────────────────────

ClienteHttp* delegua_http_novo_cliente(char* url_base, int tempo_ms) {
    ClienteHttp* cliente = (ClienteHttp*)calloc(1, sizeof(ClienteHttp));
    if (!cliente) return NULL;
    cliente->url_base        = url_base ? strdup(url_base) : NULL;
    cliente->tempo_maximo_ms = tempo_ms > 0 ? (long)tempo_ms : 30000L;
    cliente->cabecalhos      = NULL;
    cliente->num_cabecalhos  = 0;
    return cliente;
}

void delegua_http_add_cabecalho(ClienteHttp* cliente, char* cabecalho) {
    if (!cliente || !cabecalho) return;
    int n = cliente->num_cabecalhos;
    char** tmp = (char**)realloc(cliente->cabecalhos, (n + 1) * sizeof(char*));
    if (!tmp) return;
    tmp[n] = strdup(cabecalho);
    cliente->cabecalhos     = tmp;
    cliente->num_cabecalhos = n + 1;
}

RespostaHttp* delegua_http_get(ClienteHttp* cliente, char* sufixo) {
    return requisitar(cliente, "GET", sufixo, NULL);
}

RespostaHttp* delegua_http_post(ClienteHttp* cliente, char* sufixo, char* corpo) {
    return requisitar(cliente, "POST", sufixo, corpo ? corpo : "");
}

RespostaHttp* delegua_http_put(ClienteHttp* cliente, char* sufixo, char* corpo) {
    return requisitar(cliente, "PUT", sufixo, corpo ? corpo : "");
}

RespostaHttp* delegua_http_delete(ClienteHttp* cliente, char* sufixo) {
    return requisitar(cliente, "DELETE", sufixo, NULL);
}

RespostaHttp* delegua_http_patch(ClienteHttp* cliente, char* sufixo, char* corpo) {
    return requisitar(cliente, "PATCH", sufixo, corpo ? corpo : "");
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
