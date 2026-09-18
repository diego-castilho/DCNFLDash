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

export async function buscarJson(url, tentativas = 4) {
  let ultimoErro;
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "DCNFLDash/1.0 (+github.com/diego-castilho/DCNFLDash)" } });
      if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
      return await r.json();
    } catch (e) {
      ultimoErro = e;
      // 429 é limite de taxa: esperar pouco só gasta outra tentativa à toa.
      const espera = e.status === 429 ? 15000 * (i + 1) : 1500 * (i + 1);
      await new Promise(r => setTimeout(r, espera));
    }
  }
  throw new Error(`falha ao buscar ${url}: ${ultimoErro.message}`);
}

/* ---------------------------------------------------------------------------
   Emissoras dos EUA e pacotes de prime time
   --------------------------------------------------------------------------- */

/** A ESPN devolve o nome comercial; aqui ele vira uma chave estável do catálogo. */
const ALIAS_EMISSORA = {
  "cbs": "cbs", "fox": "fox", "nbc": "nbc", "abc": "abc", "espn": "espn",
  "espn+": "espn", "espn2": "espn", "prime video": "prime", "amazon prime video": "prime",
  "nfl net": "nflnet", "nfl network": "nflnet", "netflix": "netflix",
  "peacock": "peacock", "nfl+": "nflplus"
};
export const emissorasDe = bruto =>
  (bruto || "").split("/").map(s => ALIAS_EMISSORA[s.trim().toLowerCase()])
    .filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

/**
 * Pacote de prime time do jogo, se houver.
 * O dia da semana é em Brasília; é o mesmo dia dos EUA nesses horários.
 * O jogo de Black Friday também é do Prime Video nos EUA e NÃO é TNF — por isso
 * a regra exige quinta-feira, e não apenas a emissora.
 */
export function pacoteDe(kickoffIso, emissoraBruta) {
  const emissoras = emissorasDe(emissoraBruta);
  const d = new Date(kickoffIso).toLocaleDateString("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" });
  const h = Number(new Date(kickoffIso).toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }));
  if (d === "Thu" && emissoras.includes("prime")) return "TNF";
  if (d === "Sun" && h >= 20 && emissoras.includes("nbc")) return "SNF";
  if (d === "Mon" && (emissoras.includes("espn") || emissoras.includes("abc"))) return "MNF";
  return null;
}

/** Como buscarJson, mas devolve o corpo em texto — para páginas HTML. */
export async function buscarTexto(url, tentativas = 4) {
  let ultimoErro;
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(25000),
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) DCNFLDash/1.0" }
      });
      if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
      return await r.text();
    } catch (e) {
      ultimoErro = e;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw new Error(`falha ao buscar ${url}: ${ultimoErro.message}`);
}
