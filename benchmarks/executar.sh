#!/bin/bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"
OUT="$DIR/build"
RUNS=${1:-3}

mkdir -p "$OUT"

echo "========================================"
echo " Benchmark Suite: Delegua vs C vs Rust"
echo " Execuções por linguagem: $RUNS"
echo "========================================"

benchmark() {
    local name="$1"
    local cmd="$2"
    local total=0

    for i in $(seq 1 "$RUNS"); do
        start=$(python3 -c "import time; print(int(time.time()*1000))")
        eval "$cmd" > /dev/null
        end=$(python3 -c "import time; print(int(time.time()*1000))")
        elapsed=$((end - start))
        total=$((total + elapsed))
    done

    avg=$((total / RUNS))
    printf "  %-25s %6dms\n" "$name" "$avg"
}

run_benchmark() {
    local NOME="$1"
    local ARQUIVO="$2"
    local ESPERADO="$3"

    echo ""
    echo "----------------------------------------"
    echo " $NOME"
    echo "----------------------------------------"

    echo ""
    echo "▶ Compilando..."

    clang -O2 "$DIR/${ARQUIVO}.c" -o "$OUT/${ARQUIVO}_c"
    echo "  C (clang -O2): ok"

    rustc -C opt-level=2 "$DIR/${ARQUIVO}.rs" -o "$OUT/${ARQUIVO}_rust"
    echo "  Rust (-C opt-level=2): ok"

    (cd "$ROOT" && yarn executar "$DIR/${ARQUIVO}.delegua" -o "${ARQUIVO}_delegua") > /dev/null 2>&1
    mv "$DIR/${ARQUIVO}_delegua" "$OUT/${ARQUIVO}_delegua"
    echo "  Delegua (LLVM -O2): ok"

    echo ""
    echo "▶ Verificando corretude..."

    RESULT_C=$("$OUT/${ARQUIVO}_c" | tr -d '[:space:]')
    RESULT_RUST=$("$OUT/${ARQUIVO}_rust" | tr -d '[:space:]')
    RESULT_DELEGUA=$("$OUT/${ARQUIVO}_delegua" | tr -d '[:space:]')

    PASS=true

    for LANG_NAME in C Rust Delegua; do
        eval "RESULT=\$RESULT_$(echo $LANG_NAME | tr '[:upper:]' '[:lower:]' | sed 's/delegua/delegua/' | sed 's/rust/rust/')"
        case "$LANG_NAME" in
            C) RESULT="$RESULT_C" ;;
            Rust) RESULT="$RESULT_RUST" ;;
            Delegua) RESULT="$RESULT_DELEGUA" ;;
        esac

        if [ "$RESULT" != "$ESPERADO" ]; then
            echo "  FALHA $LANG_NAME: esperado $ESPERADO, obteve $RESULT"
            PASS=false
        else
            echo "  $LANG_NAME: $RESULT ✓"
        fi
    done

    if [ "$PASS" = false ]; then
        echo "  AVISO: Resultados incorretos, pulando benchmark."
        return
    fi

    echo ""
    echo "▶ Resultados:"

    benchmark "C (clang -O2)" "$OUT/${ARQUIVO}_c"
    benchmark "Rust (opt-level=2)" "$OUT/${ARQUIVO}_rust"
    benchmark "Delegua (LLVM -O2)" "$OUT/${ARQUIVO}_delegua"
}

# --- Benchmarks ---

run_benchmark "Fibonacci Recursivo (fib 40)" "fibonacci" "102334155"
run_benchmark "Contagem de Primos (até 1M)" "primos" "78498"
run_benchmark "Bubble Sort (10000 elementos)" "bubblesort" "1"
run_benchmark "Crivo de Eratóstenes (até 1M)" "crivo" "78498"
run_benchmark "Soma de Dígitos (1 a 10M)" "somadigitos" "315000001"
run_benchmark "Ackermann (3, 11)" "ackermann" "16381"

echo ""
echo "========================================"
echo " Concluído"
echo "========================================"

rm -rf "$OUT"
