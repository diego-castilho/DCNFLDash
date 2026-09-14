/**
 * Extrai os dados embutidos no painel v1 (legado/painel-v1.html) para arquivos
 * separados: catálogo de times, catálogo de canais e os escudos/logos em disco.
 *
 * Roda uma única vez, na migração. Mantido no repositório como registro de
 * como os dados originais foram obtidos — ver docs/DADOS.md.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(`${raiz}/legado/painel-v1.html`, "utf8");

// O bloco de dados vai de "const ATUALIZADO_EM" até a primeira função de render.
const ini = html.indexOf("const ATUALIZADO_EM");
const fim = html.indexOf("const $ = s => document.querySelector");
if (ini < 0 || fim < 0) throw new Error("não achei o bloco de dados no HTML legado");
const bloco = html.slice(ini, fim);

const dados = new Function(`${bloco}
  return { ATUALIZADO_EM, TIMES, CANAIS, SEMANAS, NETFLIX, STEELERS, ESCUDOS };`)();

const extensoes = { "image/png": "png", "image/webp": "webp", "image/jpeg": "jpg", "image/svg+xml": "svg" };
function gravarDataUri(uri, destinoSemExtensao) {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(uri || "");
  if (!m) return null;
  const ext = extensoes[m[1]] || "bin";
  const caminho = `${destinoSemExtensao}.${ext}`;
  mkdirSync(dirname(caminho), { recursive: true });
  writeFileSync(caminho, Buffer.from(m[2], "base64"));
  return caminho.replace(`${raiz}/site/`, "");
}

// ---- times -------------------------------------------------------------
const times = {};
for (const [sigla, [apelido, cor, corTexto]] of Object.entries(dados.TIMES)) {
  const arquivo = gravarDataUri(dados.ESCUDOS[sigla], `${raiz}/site/assets/escudos/${sigla.toLowerCase()}`);
  times[sigla] = { sigla, apelido, cor, corTexto, escudo: arquivo };
}

// ---- canais ------------------------------------------------------------
const canais = {};
for (const [chave, c] of Object.entries(dados.CANAIS)) {
  if (chave === "tbd") continue;
  const arquivo = gravarDataUri(c.logo, `${raiz}/site/assets/canais/${chave}`);
  canais[chave] = {
    chave, nome: c.nome, cor: c.cor, corTexto: c.txt,
    assinado: !!c.voce, contaComoTvBr: chave !== "gamepass",
    logo: arquivo, svg: c.svg || "", onde: c.onde
  };
}

// ---- grade brasileira já conhecida (semanas 1 a 3 do painel v1) ---------
const grade = {};
for (const semana of dados.SEMANAS) {
  for (const dia of semana.dias) {
    for (const j of dia.jogos) {
      if (!j.canais || j.canais.includes("tbd")) continue;
      const canaisBr = j.canais.filter(k => k !== "gamepass");
      if (!canaisBr.length) continue;
      grade[`${semana.n}:${j.f}@${j.c}`] = {
        semana: semana.n, visitante: j.f, mandante: j.c, canais: canaisBr,
        fonte: "painel v1 (migração)", url: "", checadoEm: "2026-09-13", confianca: "confirmado"
      };
    }
  }
}

const esc = o => JSON.stringify(o, null, 2) + "\n";
writeFileSync(`${raiz}/dados/times.json`, esc(times));
writeFileSync(`${raiz}/dados/canais.json`, esc(canais));
writeFileSync(`${raiz}/dados/canais-br.json`, esc({ atualizadoEm: "2026-09-13", jogos: grade }));
writeFileSync(`${raiz}/legado/steelers-v1.json`, esc(dados.STEELERS));
writeFileSync(`${raiz}/legado/netflix-v1.json`, esc(dados.NETFLIX));

console.log(`times: ${Object.keys(times).length} | canais: ${Object.keys(canais).length} | grade br: ${Object.keys(grade).length}`);
