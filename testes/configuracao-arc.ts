// Fase 5.1 do ARC: todo programa que os testes compilam e executam roda no modo estrito de
// DELEGUA_ARC_DEPURACAO. Se alguma alocação gerenciada continuar viva ao fim normal do programa
// (depois da coleta de ciclos final), ele sai com código 99 e o teste falha.
// Uma variável já definida no ambiente (ex.: DELEGUA_ARC_DEPURACAO=1 para só ver o relatório)
// é respeitada.
if (process.env.DELEGUA_ARC_DEPURACAO === undefined) {
    process.env.DELEGUA_ARC_DEPURACAO = 'estrito';
}
