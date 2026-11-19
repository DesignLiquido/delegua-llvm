#pragma once
#include "vetor.h"

// Encerra o programa com o código de saída informado (descarrega stdout/stderr antes).
void  delegua_processo_sair(int codigo);

// Escreve o texto na saída de erro (stderr), seguido de quebra de linha.
void  delegua_processo_escrever_erro(char* texto);

// Sistema operacional para o qual o programa foi compilado:
// "windows", "darwin", "linux", "freebsd", "wasm" ou "desconhecido".
char* delegua_processo_sistema_operacional(void);

// Arquitetura para a qual o programa foi compilado:
// "amd64", "arm64", "386", "arm", "riscv64", "wasm32" ou "desconhecida".
char* delegua_processo_arquitetura(void);

// Valor da variável de ambiente, ou NULL (nulo) se não estiver definida.
char* delegua_processo_variavel_ambiente(char* nome);

// Define a variável de ambiente para este processo e seus filhos. Retorna 1 em caso de sucesso.
int   delegua_processo_definir_variavel_ambiente(char* nome, char* valor);

// Executa `programa` com `argumentos` (texto[], pode ser NULL) no `diretorio` (NULL ou "":
// diretório atual), herdando stdin/stdout/stderr. Não passa por um shell: os argumentos
// chegam ao programa exatamente como informados. Retorna o código de saída, ou -1 se o
// programa não pôde ser iniciado.
int   delegua_processo_executar(char* programa, Vetor* argumentos, char* diretorio);

// Como delegua_processo_executar, mas captura e retorna a saída padrão (stdout) do programa.
// O código de saída fica disponível em delegua_processo_ultimo_codigo_saida().
char* delegua_processo_executar_capturando(char* programa, Vetor* argumentos, char* diretorio);

// Código de saída da última chamada a executar/executarCapturando (-1: não iniciou).
int   delegua_processo_ultimo_codigo_saida(void);
