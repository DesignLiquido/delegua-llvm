#!/usr/bin/env node
// Prepara o diretório dist/ para publicação no npm.
//
// O release-it publica o dist/ como raiz do pacote (`npm.publishPath` no .release-it.json),
// então o package.json copiado para lá precisa apontar para os arquivos como ficam dentro
// do dist/: o `bin` "./dist/ilc.js" do package.json da raiz vira "ilc.js". Sem isso, a
// instalação pelo npm não cria o comando `delegua-llvm`.
//
// Também copia o LICENSE e o README.md, que ficam fora do dist/.
//
// Uso: node ferramentas/preparar-distribuicao.js   (no `yarn empacotar` e no hook
// after:bump do release-it, que regrava o package.json com a nova versão)
const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const dist = path.join(raiz, 'dist');

if (!fs.existsSync(dist)) {
    console.error('dist/ não existe; rode `yarn empacotar` antes.');
    process.exit(1);
}

const pacote = JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf-8'));

// Caminho relativo à raiz do repositório → relativo ao dist/.
function relativoAoDist(caminho) {
    const normalizado = caminho.replace(/^\.\//, '');
    return normalizado.startsWith('dist/') ? normalizado.slice('dist/'.length) : normalizado;
}

if (typeof pacote.bin === 'string') {
    pacote.bin = relativoAoDist(pacote.bin);
} else if (pacote.bin) {
    for (const nome of Object.keys(pacote.bin)) {
        pacote.bin[nome] = relativoAoDist(pacote.bin[nome]);
    }
}
for (const campo of ['main', 'types']) {
    if (typeof pacote[campo] === 'string') pacote[campo] = relativoAoDist(pacote[campo]);
}

fs.writeFileSync(path.join(dist, 'package.json'), JSON.stringify(pacote, null, 2) + '\n');

for (const arquivo of ['LICENSE', 'README.md']) {
    fs.copyFileSync(path.join(raiz, arquivo), path.join(dist, arquivo));
}

console.log(`dist/ preparado: bin ${JSON.stringify(pacote.bin)}, LICENSE e README.md copiados.`);
