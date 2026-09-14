/**
 * Monta a pasta _site — o que vai para o GitHub Pages e o que se abre localmente.
 * Existe para que o ambiente local e o de publicação sejam montados pelo mesmo
 * código; divergência entre os dois é a origem clássica de "funciona aqui".
 */
import { cpSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { RAIZ } from "./lib/comum.mjs";

const destino = `${RAIZ}/_site`;
rmSync(destino, { recursive: true, force: true });
mkdirSync(`${destino}/dados`, { recursive: true });

cpSync(`${RAIZ}/site`, destino, { recursive: true });
for (const f of readdirSync(`${RAIZ}/dados`).filter(f => f.endsWith(".json"))) {
  cpSync(`${RAIZ}/dados/${f}`, `${destino}/dados/${f}`);
}
console.log(`_site montado (${readdirSync(destino).length} itens na raiz)`);
