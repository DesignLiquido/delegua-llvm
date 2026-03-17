// Sub-fase F.1c — AES-256-GCM e RSA.
// Compilar com: clang ... criptografia-aes-rsa.c -lcrypto -lssl
#include "criptografia.h"
#include <openssl/evp.h>
#include <openssl/pem.h>
#include <openssl/bio.h>
#include <openssl/rand.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// ── Utilitários internos ─────────────────────────────────────────────────────

// Bytes → hex string (alocado).
static char* bytes_para_hex(const unsigned char* b, size_t n) {
    char* h = (char*)malloc(n * 2 + 1);
    if (!h) return NULL;
    for (size_t i = 0; i < n; i++) sprintf(h + i * 2, "%02x", b[i]);
    h[n * 2] = '\0';
    return h;
}

// Hex string → bytes (alocado). Retorna número de bytes em *out_len.
static unsigned char* hex_para_bytes(const char* hex, size_t* out_len) {
    size_t hex_len = strlen(hex);
    if (hex_len % 2 != 0) return NULL;
    size_t n = hex_len / 2;
    unsigned char* b = (unsigned char*)malloc(n);
    if (!b) return NULL;
    for (size_t i = 0; i < n; i++) {
        unsigned int byte;
        sscanf(hex + i * 2, "%02x", &byte);
        b[i] = (unsigned char)byte;
    }
    *out_len = n;
    return b;
}

// Deriva 32 bytes de chave AES a partir de uma string (SHA-256).
static int derivar_chave_aes(const char* s, unsigned char out[32]) {
    EVP_MD_CTX* ctx = EVP_MD_CTX_new();
    if (!ctx) return 0;
    unsigned int len = 0;
    int ok = EVP_DigestInit_ex(ctx, EVP_sha256(), NULL)
          && EVP_DigestUpdate(ctx, s, strlen(s))
          && EVP_DigestFinal_ex(ctx, out, &len);
    EVP_MD_CTX_free(ctx);
    return ok && len == 32;
}

// Deriva 12 bytes de nonce GCM a partir de uma string (primeiros 12 bytes de MD5).
static int derivar_nonce_gcm(const char* s, unsigned char out[12]) {
    if (!s || s[0] == '\0') { memset(out, 0, 12); return 1; }
    EVP_MD_CTX* ctx = EVP_MD_CTX_new();
    if (!ctx) return 0;
    unsigned char md5[16];
    unsigned int  len = 0;
    int ok = EVP_DigestInit_ex(ctx, EVP_md5(), NULL)
          && EVP_DigestUpdate(ctx, s, strlen(s))
          && EVP_DigestFinal_ex(ctx, md5, &len);
    EVP_MD_CTX_free(ctx);
    if (!ok) return 0;
    memcpy(out, md5, 12);
    return 1;
}

// ── AES-256-GCM ─────────────────────────────────────────────────────────────
//
// Formato do ciphertext: hex(bytes_cifrados) + hex(tag_16_bytes)
// Tamanho da saída: 2*(len(texto) + 16) caracteres.

char* delegua_cript_aes256_cifrar(char* texto, char* chave, char* iv) {
    if (!texto || !chave) return NULL;
    int tam_texto = (int)strlen(texto);

    unsigned char key[32], nonce[12];
    if (!derivar_chave_aes(chave, key)) return NULL;
    if (!derivar_nonce_gcm(iv ? iv : "", nonce)) return NULL;

    unsigned char* cifrado = (unsigned char*)malloc(tam_texto + 1);
    if (!cifrado) return NULL;

    EVP_CIPHER_CTX* ctx = EVP_CIPHER_CTX_new();
    if (!ctx) { free(cifrado); return NULL; }

    int len1 = 0, len2 = 0;
    EVP_EncryptInit_ex(ctx, EVP_aes_256_gcm(), NULL, NULL, NULL);
    EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN, 12, NULL);
    EVP_EncryptInit_ex(ctx, NULL, NULL, key, nonce);
    EVP_EncryptUpdate(ctx, cifrado, &len1, (unsigned char*)texto, tam_texto);
    EVP_EncryptFinal_ex(ctx, cifrado + len1, &len2);

    unsigned char tag[16];
    EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_GET_TAG, 16, tag);
    EVP_CIPHER_CTX_free(ctx);

    int total = len1 + len2;
    // resultado = hex(ciphertext) + hex(tag)
    char* resultado = (char*)malloc((total + 16) * 2 + 1);
    if (!resultado) { free(cifrado); return NULL; }
    for (int i = 0; i < total; i++) sprintf(resultado + i * 2, "%02x", cifrado[i]);
    for (int i = 0; i < 16; i++) sprintf(resultado + (total + i) * 2, "%02x", tag[i]);
    resultado[(total + 16) * 2] = '\0';

    free(cifrado);
    return resultado;
}

char* delegua_cript_aes256_decifrar(char* cifrado_hex, char* chave, char* iv) {
    if (!cifrado_hex || !chave) return NULL;
    int hex_len = (int)strlen(cifrado_hex);
    if (hex_len < 32) return NULL; // mínimo: texto vazio + tag (32 hex chars)

    // Últimos 32 hex chars = tag (16 bytes)
    int texto_hex_len = hex_len - 32;
    int n_texto = texto_hex_len / 2;

    size_t dummy;
    unsigned char* bytes_cifrados = hex_para_bytes(cifrado_hex, &dummy);
    if (!bytes_cifrados) return NULL;
    unsigned char tag[16];
    for (int i = 0; i < 16; i++) {
        unsigned int b;
        sscanf(cifrado_hex + texto_hex_len + i * 2, "%02x", &b);
        tag[i] = (unsigned char)b;
    }

    unsigned char key[32], nonce[12];
    if (!derivar_chave_aes(chave, key) || !derivar_nonce_gcm(iv ? iv : "", nonce)) {
        free(bytes_cifrados); return NULL;
    }

    unsigned char* plain = (unsigned char*)malloc(n_texto + 1);
    if (!plain) { free(bytes_cifrados); return NULL; }

    EVP_CIPHER_CTX* ctx = EVP_CIPHER_CTX_new();
    if (!ctx) { free(bytes_cifrados); free(plain); return NULL; }

    int len1 = 0, len2 = 0;
    EVP_DecryptInit_ex(ctx, EVP_aes_256_gcm(), NULL, NULL, NULL);
    EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN, 12, NULL);
    EVP_DecryptInit_ex(ctx, NULL, NULL, key, nonce);
    EVP_DecryptUpdate(ctx, plain, &len1, bytes_cifrados, n_texto);
    EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_TAG, 16, tag);
    int ok = EVP_DecryptFinal_ex(ctx, plain + len1, &len2);
    EVP_CIPHER_CTX_free(ctx);
    free(bytes_cifrados);

    if (ok <= 0) { free(plain); return NULL; } // falha de autenticação GCM
    plain[len1 + len2] = '\0';
    return (char*)plain;
}

// ── RSA ──────────────────────────────────────────────────────────────────────

// Gera chave privada RSA com bits bits; retorna PEM alocado.
char* delegua_cript_rsa_gerar_privada(int bits) {
    if (bits < 512) bits = 2048;
    EVP_PKEY_CTX* ctx = EVP_PKEY_CTX_new_id(EVP_PKEY_RSA, NULL);
    if (!ctx) return NULL;

    EVP_PKEY* pkey = NULL;
    if (EVP_PKEY_keygen_init(ctx) <= 0
     || EVP_PKEY_CTX_set_rsa_keygen_bits(ctx, bits) <= 0
     || EVP_PKEY_keygen(ctx, &pkey) <= 0) {
        EVP_PKEY_CTX_free(ctx); return NULL;
    }
    EVP_PKEY_CTX_free(ctx);

    BIO* bio = BIO_new(BIO_s_mem());
    PEM_write_bio_PrivateKey(bio, pkey, NULL, NULL, 0, NULL, NULL);
    EVP_PKEY_free(pkey);

    BUF_MEM* bptr;
    BIO_get_mem_ptr(bio, &bptr);
    char* pem = (char*)malloc(bptr->length + 1);
    if (pem) { memcpy(pem, bptr->data, bptr->length); pem[bptr->length] = '\0'; }
    BIO_free(bio);
    return pem;
}

// Deriva chave pública PEM a partir de chave privada PEM.
char* delegua_cript_rsa_derivar_publica(char* chave_privada_pem) {
    if (!chave_privada_pem) return NULL;
    BIO* bio_in = BIO_new_mem_buf(chave_privada_pem, -1);
    EVP_PKEY* pkey = PEM_read_bio_PrivateKey(bio_in, NULL, NULL, NULL);
    BIO_free(bio_in);
    if (!pkey) return NULL;

    BIO* bio_out = BIO_new(BIO_s_mem());
    PEM_write_bio_PUBKEY(bio_out, pkey);
    EVP_PKEY_free(pkey);

    BUF_MEM* bptr;
    BIO_get_mem_ptr(bio_out, &bptr);
    char* pem = (char*)malloc(bptr->length + 1);
    if (pem) { memcpy(pem, bptr->data, bptr->length); pem[bptr->length] = '\0'; }
    BIO_free(bio_out);
    return pem;
}

// Cifra texto com chave pública RSA-OAEP-SHA256; retorna hex.
char* delegua_cript_rsa_cifrar(char* texto, char* chave_publica_pem) {
    if (!texto || !chave_publica_pem) return NULL;
    BIO* bio = BIO_new_mem_buf(chave_publica_pem, -1);
    EVP_PKEY* pkey = PEM_read_bio_PUBKEY(bio, NULL, NULL, NULL);
    BIO_free(bio);
    if (!pkey) return NULL;

    EVP_PKEY_CTX* ctx = EVP_PKEY_CTX_new(pkey, NULL);
    EVP_PKEY_free(pkey);
    if (!ctx) return NULL;

    EVP_PKEY_encrypt_init(ctx);
    EVP_PKEY_CTX_set_rsa_padding(ctx, RSA_PKCS1_OAEP_PADDING);
    EVP_PKEY_CTX_set_rsa_oaep_md(ctx, EVP_sha256());

    size_t out_len = 0;
    EVP_PKEY_encrypt(ctx, NULL, &out_len, (unsigned char*)texto, strlen(texto));
    unsigned char* cifrado = (unsigned char*)malloc(out_len);
    EVP_PKEY_encrypt(ctx, cifrado, &out_len, (unsigned char*)texto, strlen(texto));
    EVP_PKEY_CTX_free(ctx);

    char* hex = bytes_para_hex(cifrado, out_len);
    free(cifrado);
    return hex;
}

// Decifra ciphertext hex com chave privada RSA-OAEP-SHA256; retorna plaintext.
char* delegua_cript_rsa_decifrar(char* cifrado_hex, char* chave_privada_pem) {
    if (!cifrado_hex || !chave_privada_pem) return NULL;
    size_t n_bytes;
    unsigned char* cifrado = hex_para_bytes(cifrado_hex, &n_bytes);
    if (!cifrado) return NULL;

    BIO* bio = BIO_new_mem_buf(chave_privada_pem, -1);
    EVP_PKEY* pkey = PEM_read_bio_PrivateKey(bio, NULL, NULL, NULL);
    BIO_free(bio);
    if (!pkey) { free(cifrado); return NULL; }

    EVP_PKEY_CTX* ctx = EVP_PKEY_CTX_new(pkey, NULL);
    EVP_PKEY_free(pkey);
    if (!ctx) { free(cifrado); return NULL; }

    EVP_PKEY_decrypt_init(ctx);
    EVP_PKEY_CTX_set_rsa_padding(ctx, RSA_PKCS1_OAEP_PADDING);
    EVP_PKEY_CTX_set_rsa_oaep_md(ctx, EVP_sha256());

    size_t plain_len = 0;
    EVP_PKEY_decrypt(ctx, NULL, &plain_len, cifrado, n_bytes);
    unsigned char* plain = (unsigned char*)malloc(plain_len + 1);
    int ok = EVP_PKEY_decrypt(ctx, plain, &plain_len, cifrado, n_bytes);
    EVP_PKEY_CTX_free(ctx);
    free(cifrado);

    if (ok <= 0) { free(plain); return NULL; }
    plain[plain_len] = '\0';
    return (char*)plain;
}

// Assina texto com chave privada RSA (SHA-256); retorna assinatura hex.
char* delegua_cript_rsa_assinar(char* texto, char* chave_privada_pem) {
    if (!texto || !chave_privada_pem) return NULL;
    BIO* bio = BIO_new_mem_buf(chave_privada_pem, -1);
    EVP_PKEY* pkey = PEM_read_bio_PrivateKey(bio, NULL, NULL, NULL);
    BIO_free(bio);
    if (!pkey) return NULL;

    EVP_MD_CTX* ctx = EVP_MD_CTX_new();
    EVP_DigestSignInit(ctx, NULL, EVP_sha256(), NULL, pkey);
    EVP_DigestSignUpdate(ctx, texto, strlen(texto));

    size_t sig_len = 0;
    EVP_DigestSignFinal(ctx, NULL, &sig_len);
    unsigned char* sig = (unsigned char*)malloc(sig_len);
    EVP_DigestSignFinal(ctx, sig, &sig_len);
    EVP_MD_CTX_free(ctx);
    EVP_PKEY_free(pkey);

    char* hex = bytes_para_hex(sig, sig_len);
    free(sig);
    return hex;
}

// Verifica assinatura hex com chave pública RSA (SHA-256). Retorna 1=válido, 0=inválido.
int delegua_cript_rsa_verificar(char* texto, char* assinatura_hex, char* chave_publica_pem) {
    if (!texto || !assinatura_hex || !chave_publica_pem) return 0;
    size_t n_bytes;
    unsigned char* sig = hex_para_bytes(assinatura_hex, &n_bytes);
    if (!sig) return 0;

    BIO* bio = BIO_new_mem_buf(chave_publica_pem, -1);
    EVP_PKEY* pkey = PEM_read_bio_PUBKEY(bio, NULL, NULL, NULL);
    BIO_free(bio);
    if (!pkey) { free(sig); return 0; }

    EVP_MD_CTX* ctx = EVP_MD_CTX_new();
    EVP_DigestVerifyInit(ctx, NULL, EVP_sha256(), NULL, pkey);
    EVP_DigestVerifyUpdate(ctx, texto, strlen(texto));
    int resultado = (EVP_DigestVerifyFinal(ctx, sig, n_bytes) == 1) ? 1 : 0;
    EVP_MD_CTX_free(ctx);
    EVP_PKEY_free(pkey);
    free(sig);
    return resultado;
}
