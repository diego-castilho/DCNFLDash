/** Utilidades compartilhadas pelos scripts. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const TEMPORADA = 2026;

/** ESPN usa algumas siglas diferentes das do painel. */
export const ALIAS_ESPN = { WSH: "WAS" };
export const sigla = s => ALIAS_ESPN[s] || s;

export const lerJson = (caminho, padrao = null) => {
  try { return JSON.parse(readFileSync(`${RAIZ}/${caminho}`, "utf8")); }
  catch { return padrao; }
};

export const gravarJson = (caminho, dados) => {
  mkdirSync(dirname(`${RAIZ}/${caminho}`), { recursive: true });
  writeFileSync(`${RAIZ}/${caminho}`, JSON.stringify(dados, null, 2) + "\n");
};

export const agoraIso = () => new Date().toISOString();

/** Data no fuso de Brasília (AAAA-MM-DD) a partir de um ISO em UTC. */
export const diaBrasilia = iso =>
  new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

export async function buscarJson(url, tentativas = 3) {
  let ultimoErro;
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "DCNFLDash/1.0 (+github.com/diego-castilho/DCNFLDash)" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      ultimoErro = e;
      await new Promise(r => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw new Error(`falha ao buscar ${url}: ${ultimoErro.message}`);
}
