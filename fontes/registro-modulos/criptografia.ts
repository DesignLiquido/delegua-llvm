import llvm from '@designliquido/llvm-bindings';
import type { CompiladorLLVM } from '../compilador-llvm';
import { EntradaFuncaoModulo } from '../interfaces/entrada-funcao-modulo';

export function registrarModuloCriptografia(this: CompiladorLLVM): void {
    const ptr = this.montador.getPtrTy();
    const i32 = this.montador.getInt32Ty();

    const reg = (nomeCFunc: string, tiposParametros: string[]): EntradaFuncaoModulo => {
        const tiposLlvm = tiposParametros.map((t) => (t === 'inteiro' ? i32 : ptr));
        const tipo = llvm.FunctionType.get(ptr, tiposLlvm, false);
        const callee = this.modulo.getOrInsertFunction(nomeCFunc, tipo);
        return { callee, tiposParametros, tipoRetorno: 'texto' };
    };
    const regInt = (nomeCFunc: string, tiposParametros: string[]): EntradaFuncaoModulo => {
        const tiposLlvm = tiposParametros.map((t) => (t === 'inteiro' ? i32 : ptr));
        const tipo = llvm.FunctionType.get(i32, tiposLlvm, false);
        const callee = this.modulo.getOrInsertFunction(nomeCFunc, tipo);
        return { callee, tiposParametros, tipoRetorno: 'inteiro' };
    };

    const funcoes = new Map<string, EntradaFuncaoModulo>([
        ['cifrarXor', reg('delegua_cript_cifrar_xor', ['texto', 'texto'])],
        ['decifrarXor', reg('delegua_cript_decifrar_xor', ['texto', 'texto'])],
        ['rot13', reg('delegua_cript_rot13', ['texto'])],
        ['rotN', reg('delegua_cript_rot_n', ['texto', 'inteiro'])],
        ['decifrarRotN', reg('delegua_cript_decifrar_rot_n', ['texto', 'inteiro'])],
        ['codificarBase64', reg('delegua_cript_base64_codificar', ['texto'])],
        ['decodificarBase64', reg('delegua_cript_base64_decodificar', ['texto'])],
        ['criptografarEmMeninoDoAcre', reg('delegua_cript_menino_do_acre_cif', ['texto'])],
        ['descriptografarDeMeninoDoAcre', reg('delegua_cript_menino_do_acre_dec', ['texto'])],
        ['md5', reg('delegua_cript_md5', ['texto'])],
        ['sha1', reg('delegua_cript_sha1', ['texto'])],
        ['sha256', reg('delegua_cript_sha256', ['texto'])],
        ['sha512', reg('delegua_cript_sha512', ['texto'])],
        ['hmacSha256', reg('delegua_cript_hmac_sha256', ['texto', 'texto'])],
        ['hmacSha512', reg('delegua_cript_hmac_sha512', ['texto', 'texto'])],
        ['gerarBytesAleatorios', reg('delegua_cript_bytes_aleatorios', ['inteiro'])],
        ['gerarTextoAleatorio', reg('delegua_cript_texto_aleatorio', ['inteiro'])],
        ['gerarUuid', reg('delegua_cript_uuid', [])],
        ['derivarChavePbkdf2', reg('delegua_cript_pbkdf2', ['texto', 'texto', 'inteiro', 'inteiro'])],
        ['criptografarAes256', reg('delegua_cript_aes256_cifrar', ['texto', 'texto', 'texto'])],
        ['descriptografarAes256', reg('delegua_cript_aes256_decifrar', ['texto', 'texto', 'texto'])],
        ['gerarChavePrivadaRsa', reg('delegua_cript_rsa_gerar_privada', ['inteiro'])],
        ['derivarChavePublicaRsa', reg('delegua_cript_rsa_derivar_publica', ['texto'])],
        ['criptografarRsa', reg('delegua_cript_rsa_cifrar', ['texto', 'texto'])],
        ['descriptografarRsa', reg('delegua_cript_rsa_decifrar', ['texto', 'texto'])],
        ['assinarRsa', reg('delegua_cript_rsa_assinar', ['texto', 'texto'])],
        ['verificarAssinaturaRsa', regInt('delegua_cript_rsa_verificar', ['texto', 'texto', 'texto'])],
    ]);

    this.mapaModulos.set('criptografia', funcoes);
}
