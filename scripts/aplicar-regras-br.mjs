/**
 * Aplica as regras FIXAS da temporada na grade brasileira.
 *
 * Não é palpite: são os pacotes contratados para a temporada inteira, os mesmos
 * descritos na página "onde cada canal transmite".
 *
 *   SporTV .... todos os Thursday Night (pacote Prime Video nos EUA)
 *               todos os Sunday Night (pacote NBC nos EUA)
 *   ESPN ...... todos os Monday Night (pacote ESPN/ABC nos EUA)
 *   Netflix ... os jogos que a própria Netflix transmite globalmente
 *
 * O que NÃO é regra fixa e portanto este script não toca:
 *   - os jogos de domingo à tarde, que são escolhidos rodada a rodada
 *   - Black Friday e os jogos internacionais sem detentor definido no Brasil
 *   - qualquer jogo que já tenha entrada manual — confirmação de gente sempre vence
 *
 * Roda depois do sync e antes da validação. É idempotente.
 */
import { lerJson, gravarJson, agoraIso } from "./lib/comum.mjs";

const temporada = lerJson("dados/temporada.json");
const grade = lerJson("dados/canais-br.json", { atualizadoEm: "", jogos: {} });

// O pacote (TNF/SNF/MNF) já vem calculado do sync, em scripts/lib/comum.mjs —
// a mesma definição serve para a marca no painel e para a regra de canal aqui.
const POR_PACOTE = {
  TNF: { canais: ["sportv"], regra: "Thursday Night · pacote do SporTV" },
  SNF: { canais: ["sportv"], regra: "Sunday Night · pacote do SporTV" },
  MNF: { canais: ["espn"],   regra: "Monday Night · pacote da ESPN" }
};

function regraPara(j) {
  if ((j.emissoras || []).includes("netflix")) return { canais: ["netflix"], regra: "Netflix transmite globalmente" };
  return POR_PACOTE[j.pacote] || null;
}

let novos = 0, mantidos = 0;
for (const s of temporada.semanas) {
  for (const j of s.jogos) {
    if (j.aDefinir) continue;
    const chave = `${j.semana}:${j.visitante}@${j.mandante}`;
    const r = regraPara(j);
    if (!r) continue;
    const atual = grade.jogos[chave];
    if (atual && !/^regra fixa/.test(atual.fonte || "")) { mantidos++; continue; }
    grade.jogos[chave] = {
      fase: j.fase, semana: j.semana, visitante: j.visitante, mandante: j.mandante,
      canais: r.canais,
      fonte: `regra fixa · ${r.regra}`,
      url: "",
      checadoEm: agoraIso().slice(0, 10),
      confianca: "confirmado"
    };
    novos++;
  }
}

grade.atualizadoEm = agoraIso().slice(0, 10);
gravarJson("dados/canais-br.json", grade);
console.log(`regras fixas aplicadas: ${novos} jogo(s) · ${mantidos} mantido(s) por confirmação manual`);
