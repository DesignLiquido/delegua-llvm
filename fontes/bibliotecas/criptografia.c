#include "criptografia.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

// ── XOR ─────────────────────────────────────────────────────────────────────

// Cifra: XOR byte a byte (chave cíclica), resultado como string hexadecimal.
char* delegua_cript_cifrar_xor(char* texto, char* chave) {
    if (!texto || !chave || chave[0] == '\0') return NULL;
    size_t tam_texto = strlen(texto);
    size_t tam_chave = strlen(chave);
    // 2 hex chars por byte + '\0'
    char* resultado = (char*)malloc(tam_texto * 2 + 1);
    if (!resultado) return NULL;
    for (size_t i = 0; i < tam_texto; i++) {
        unsigned char x = (unsigned char)texto[i] ^ (unsigned char)chave[i % tam_chave];
        sprintf(resultado + i * 2, "%02x", x);
    }
    resultado[tam_texto * 2] = '\0';
    return resultado;
}

// Decifra: interpreta hex, XOR byte a byte, retorna texto original.
char* delegua_cript_decifrar_xor(char* hex, char* chave) {
    if (!hex || !chave || chave[0] == '\0') return NULL;
    size_t tam_hex   = strlen(hex);
    size_t tam_bytes = tam_hex / 2;
    size_t tam_chave = strlen(chave);
    char* resultado  = (char*)malloc(tam_bytes + 1);
    if (!resultado) return NULL;
    for (size_t i = 0; i < tam_bytes; i++) {
        unsigned int byte;
        sscanf(hex + i * 2, "%02x", &byte);
        resultado[i] = (char)(byte ^ (unsigned char)chave[i % tam_chave]);
    }
    resultado[tam_bytes] = '\0';
    return resultado;
}

// ── ROT-13 / ROT-N ──────────────────────────────────────────────────────────

char* delegua_cript_rot_n(char* texto, int n) {
    if (!texto) return NULL;
    size_t tam = strlen(texto);
    char*  resultado = (char*)malloc(tam + 1);
    if (!resultado) return NULL;
    // Normaliza para 0–25
    int desl = ((n % 26) + 26) % 26;
    for (size_t i = 0; i < tam; i++) {
        char c = texto[i];
        if (c >= 'A' && c <= 'Z') {
            resultado[i] = (char)(((c - 'A' + desl) % 26) + 'A');
        } else if (c >= 'a' && c <= 'z') {
            resultado[i] = (char)(((c - 'a' + desl) % 26) + 'a');
        } else {
            resultado[i] = c;
        }
    }
    resultado[tam] = '\0';
    return resultado;
}

char* delegua_cript_rot13(char* texto) {
    return delegua_cript_rot_n(texto, 13);
}

char* delegua_cript_decifrar_rot_n(char* texto, int n) {
    return delegua_cript_rot_n(texto, -n);
}

// ── Base64 ──────────────────────────────────────────────────────────────────

static const char BASE64_ALFABETO[] =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

char* delegua_cript_base64_codificar(char* texto) {
    if (!texto) return NULL;
    size_t tam   = strlen(texto);
    // Saída: ceil(tam/3)*4 chars + '\0'
    size_t tam_b64 = ((tam + 2) / 3) * 4 + 1;
    char* resultado = (char*)malloc(tam_b64);
    if (!resultado) return NULL;

    size_t pos = 0;
    for (size_t i = 0; i < tam; i += 3) {
        unsigned char b0 = (unsigned char)texto[i];
        unsigned char b1 = (i + 1 < tam) ? (unsigned char)texto[i + 1] : 0;
        unsigned char b2 = (i + 2 < tam) ? (unsigned char)texto[i + 2] : 0;

        resultado[pos++] = BASE64_ALFABETO[b0 >> 2];
        resultado[pos++] = BASE64_ALFABETO[((b0 & 0x03) << 4) | (b1 >> 4)];
        resultado[pos++] = (i + 1 < tam) ? BASE64_ALFABETO[((b1 & 0x0f) << 2) | (b2 >> 6)] : '=';
        resultado[pos++] = (i + 2 < tam) ? BASE64_ALFABETO[b2 & 0x3f]                       : '=';
    }
    resultado[pos] = '\0';
    return resultado;
}

// Retorna valor 0–63 para um char base64, ou -1 se inválido.
static int base64_valor(char c) {
    if (c >= 'A' && c <= 'Z') return c - 'A';
    if (c >= 'a' && c <= 'z') return c - 'a' + 26;
    if (c >= '0' && c <= '9') return c - '0' + 52;
    if (c == '+') return 62;
    if (c == '/') return 63;
    return -1;
}

char* delegua_cript_base64_decodificar(char* b64) {
    if (!b64) return NULL;
    size_t tam_b64 = strlen(b64);
    if (tam_b64 % 4 != 0) return NULL;
    // Saída máxima: tam_b64/4*3 bytes + '\0'
    size_t tam_max = (tam_b64 / 4) * 3 + 1;
    char* resultado = (char*)malloc(tam_max);
    if (!resultado) return NULL;

    size_t pos = 0;
    for (size_t i = 0; i < tam_b64; i += 4) {
        int v0 = base64_valor(b64[i]);
        int v1 = base64_valor(b64[i + 1]);
        int v2 = (b64[i + 2] != '=') ? base64_valor(b64[i + 2]) : 0;
        int v3 = (b64[i + 3] != '=') ? base64_valor(b64[i + 3]) : 0;
        if (v0 < 0 || v1 < 0) { free(resultado); return NULL; }

        resultado[pos++] = (char)((v0 << 2) | (v1 >> 4));
        if (b64[i + 2] != '=') resultado[pos++] = (char)(((v1 & 0x0f) << 4) | (v2 >> 2));
        if (b64[i + 3] != '=') resultado[pos++] = (char)(((v2 & 0x03) << 6) | v3);
    }
    resultado[pos] = '\0';
    return resultado;
}

// ── Menino do Acre (tema runico) ────────────────────────────────────────────
//
// Mapeamento: a–z → U+16A0–U+16B9 (runicos Elder Futhark + extensões).
// UTF-8: cada símbolo ocupa 3 bytes: 0xE1 0x9A (0xA0 + offset).
//
// Letras maiúsculas e caracteres fora do intervalo a–z são preservados.

char* delegua_cript_menino_do_acre_cif(char* texto) {
    if (!texto) return NULL;
    size_t tam = strlen(texto);
    // Pior caso: cada char se torna 3 bytes UTF-8.
    char* resultado = (char*)malloc(tam * 3 + 1);
    if (!resultado) return NULL;

    size_t pos = 0;
    for (size_t i = 0; i < tam; i++) {
        char c = texto[i];
        char lower = (char)tolower((unsigned char)c);
        if (lower >= 'a' && lower <= 'z') {
            int offset = lower - 'a';
            resultado[pos++] = (char)0xE1;
            resultado[pos++] = (char)0x9A;
            resultado[pos++] = (char)(0xA0 + offset);
        } else {
            resultado[pos++] = c;
        }
    }
    resultado[pos] = '\0';
    return resultado;
}

char* delegua_cript_menino_do_acre_dec(char* texto) {
    if (!texto) return NULL;
    size_t tam = strlen(texto);
    // Pior caso: output menor ou igual ao input (3 bytes → 1 char).
    char* resultado = (char*)malloc(tam + 1);
    if (!resultado) return NULL;

    size_t pos  = 0;
    size_t i    = 0;
    while (i < tam) {
        unsigned char b = (unsigned char)texto[i];
        // Início de sequência runica: E1 9A (A0..B9)
        if (b == 0xE1 && i + 2 < tam
            && (unsigned char)texto[i + 1] == 0x9A
            && (unsigned char)texto[i + 2] >= 0xA0
            && (unsigned char)texto[i + 2] <= 0xB9) {
            resultado[pos++] = (char)('a' + ((unsigned char)texto[i + 2] - 0xA0));
            i += 3;
        } else {
            resultado[pos++] = texto[i++];
        }
    }
    resultado[pos] = '\0';
    return resultado;
}
