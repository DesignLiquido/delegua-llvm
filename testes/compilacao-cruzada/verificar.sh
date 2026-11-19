#!/usr/bin/env bash
# Compila inicial.delegua para cada alvo com `zig cc` e confere o resultado:
#   - o formato do executável (ELF/Mach-O/PE e arquitetura), com `file`;
#   - a saída do programa, para os alvos que esta máquina executa (nativamente ou via qemu).
#
# Uso: testes/compilacao-cruzada/verificar.sh
# Variáveis: ALVOS (lista separada por espaços; padrão: todos).
set -uo pipefail

DIRETORIO="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$DIRETORIO/../.." && pwd)"
ALVOS="${ALVOS:-linux-amd64 linux-arm64 linux-riscv64 darwin-amd64 darwin-arm64 windows-amd64 windows-arm64}"

formato_esperado() {
    case "$1" in
        linux-amd64) echo 'ELF 64-bit LSB.*x86-64' ;;
        linux-arm64) echo 'ELF 64-bit LSB.*ARM aarch64' ;;
        linux-riscv64) echo 'ELF 64-bit LSB.*RISC-V' ;;
        darwin-amd64) echo 'Mach-O 64-bit.*x86_64' ;;
        darwin-arm64) echo 'Mach-O 64-bit.*arm64' ;;
        windows-amd64) echo 'PE32\+ executable.*x86-64' ;;
        windows-arm64) echo 'PE32\+ executable.*Aarch64' ;;
    esac
}

# Comando que executa o binário nesta máquina (vazio: não executável aqui).
executor() {
    case "$1" in
        linux-amd64) echo '' ;;
        linux-arm64) echo 'qemu-aarch64 -L /usr/aarch64-linux-gnu' ;;
        linux-riscv64) echo 'qemu-riscv64 -L /usr/riscv64-linux-gnu' ;;
        *) echo 'nao-executavel' ;;
    esac
}

falhas=0
for alvo in $ALVOS; do
    echo "::group::$alvo"
    nome="sondagem-$alvo"
    binario="$DIRETORIO/$nome"
    [[ "$alvo" == windows-* ]] && binario="$binario.exe"
    rm -f "$binario"

    if ! (cd "$RAIZ" && npx ts-node fontes/ilc.ts "$DIRETORIO/inicial.delegua" --alvo "$alvo" --compilador-c "zig cc" -o "$nome"); then
        echo "::error::$alvo: falha na compilação"
        falhas=$((falhas + 1))
        echo "::endgroup::"
        continue
    fi

    descricao="$(file -b "$binario")"
    echo "file: $descricao"
    if ! grep -Eq "$(formato_esperado "$alvo")" <<<"$descricao"; then
        echo "::error::$alvo: formato inesperado: $descricao"
        falhas=$((falhas + 1))
        echo "::endgroup::"
        continue
    fi

    comando="$(executor "$alvo")"
    if [[ "$comando" == 'nao-executavel' ]]; then
        echo "$alvo: executável gerado (não executado nesta máquina)"
    else
        # escreva() termina cada linha com um espaço; compara sem espaços finais.
        obtida="$($comando "$binario" 2>&1 | sed 's/[[:space:]]*$//')"
        esperada="$(sed "s/{alvo}/$alvo/" "$DIRETORIO/saida-esperada.txt" | sed 's/[[:space:]]*$//')"
        if [[ "$obtida" == "$esperada" ]]; then
            echo "$alvo: saída correta"
        else
            echo "::error::$alvo: saída diferente da esperada"
            diff <(echo "$esperada") <(echo "$obtida") || true
            falhas=$((falhas + 1))
        fi
    fi
    echo "::endgroup::"
done

if [[ $falhas -gt 0 ]]; then
    echo "$falhas alvo(s) com falha"
    exit 1
fi
echo "Todos os alvos verificados."
