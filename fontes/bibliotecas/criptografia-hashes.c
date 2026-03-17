// Sub-fase F.1b — hashes, HMAC, aleatório, UUID, PBKDF2.
// Compilar com: clang ... criptografia-hashes.c -lcrypto
#include "criptografia.h"
#include <openssl/evp.h>
#include <openssl/hmac.h>
#include <openssl/rand.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// ── Utilitário interno ───────────────────────────────────────────────────────

// Converte n bytes em string hexadecimal alocada (minúsculas).
static char* bytes_para_hex(const unsigned char* bytes, unsigned int n) {
    char* hex = (char*)malloc(n * 2 + 1);
    if (!hex) return NULL;
    for (unsigned int i = 0; i < n; i++) {
        sprintf(hex + i * 2, "%02x", bytes[i]);
    }
    hex[n * 2] = '\0';
    return hex;
}

// Calcula um digest EVP e retorna a string hexadecimal.
static char* digest_evp(const EVP_MD* algoritmo, const char* texto) {
    if (!texto) return NULL;
    EVP_MD_CTX* ctx = EVP_MD_CTX_new();
    if (!ctx) return NULL;
    unsigned char digest[EVP_MAX_MD_SIZE];
    unsigned int  len = 0;
    EVP_DigestInit_ex(ctx, algoritmo, NULL);
    EVP_DigestUpdate(ctx, texto, strlen(texto));
    EVP_DigestFinal_ex(ctx, digest, &len);
    EVP_MD_CTX_free(ctx);
    return bytes_para_hex(digest, len);
}

// ── Hashes ───────────────────────────────────────────────────────────────────

char* delegua_cript_md5(char* texto) {
    return digest_evp(EVP_md5(), texto);
}

char* delegua_cript_sha1(char* texto) {
    return digest_evp(EVP_sha1(), texto);
}

char* delegua_cript_sha256(char* texto) {
    return digest_evp(EVP_sha256(), texto);
}

char* delegua_cript_sha512(char* texto) {
    return digest_evp(EVP_sha512(), texto);
}

// ── HMAC ─────────────────────────────────────────────────────────────────────

static char* hmac_evp(const EVP_MD* algoritmo, const char* texto, const char* chave) {
    if (!texto || !chave) return NULL;
    unsigned char digest[EVP_MAX_MD_SIZE];
    unsigned int  len = 0;
    HMAC(algoritmo,
         chave, (int)strlen(chave),
         (const unsigned char*)texto, strlen(texto),
         digest, &len);
    return bytes_para_hex(digest, len);
}

char* delegua_cript_hmac_sha256(char* texto, char* chave) {
    return hmac_evp(EVP_sha256(), texto, chave);
}

char* delegua_cript_hmac_sha512(char* texto, char* chave) {
    return hmac_evp(EVP_sha512(), texto, chave);
}

// ── Aleatório ────────────────────────────────────────────────────────────────

// Retorna n bytes aleatórios como string hexadecimal (2n chars).
char* delegua_cript_bytes_aleatorios(int n) {
    if (n <= 0) return NULL;
    unsigned char* buf = (unsigned char*)malloc(n);
    if (!buf) return NULL;
    if (RAND_bytes(buf, n) != 1) { free(buf); return NULL; }
    char* hex = bytes_para_hex(buf, (unsigned int)n);
    free(buf);
    return hex;
}

// Retorna n caracteres alfanuméricos aleatórios.
char* delegua_cript_texto_aleatorio(int n) {
    static const char ALFANUMERICO[] =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    if (n <= 0) return NULL;
    unsigned char* buf = (unsigned char*)malloc(n);
    if (!buf) return NULL;
    if (RAND_bytes(buf, n) != 1) { free(buf); return NULL; }
    char* resultado = (char*)malloc(n + 1);
    if (!resultado) { free(buf); return NULL; }
    for (int i = 0; i < n; i++) {
        resultado[i] = ALFANUMERICO[buf[i] % 62];
    }
    resultado[n] = '\0';
    free(buf);
    return resultado;
}

// ── UUID v4 ───────────────────────────────────────────────────────────────────

char* delegua_cript_uuid(void) {
    unsigned char b[16];
    if (RAND_bytes(b, 16) != 1) return NULL;
    // RFC 4122: version 4, variant 10xx
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    char* uuid = (char*)malloc(37);
    if (!uuid) return NULL;
    snprintf(uuid, 37,
        "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
        b[0],  b[1],  b[2],  b[3],
        b[4],  b[5],
        b[6],  b[7],
        b[8],  b[9],
        b[10], b[11], b[12], b[13], b[14], b[15]);
    return uuid;
}

// ── PBKDF2 ───────────────────────────────────────────────────────────────────

// Deriva uma chave de tam bytes a partir de senha + sal com iter iterações (SHA-256).
// Retorna string hexadecimal.
char* delegua_cript_pbkdf2(char* senha, char* sal, int iter, int tam) {
    if (!senha || !sal || iter <= 0 || tam <= 0) return NULL;
    unsigned char* chave = (unsigned char*)malloc(tam);
    if (!chave) return NULL;
    PKCS5_PBKDF2_HMAC(
        senha, (int)strlen(senha),
        (const unsigned char*)sal, (int)strlen(sal),
        iter, EVP_sha256(), tam, chave);
    char* hex = bytes_para_hex(chave, (unsigned int)tam);
    free(chave);
    return hex;
}
