/**
 * Descobre em que canal brasileiro cada jogo vai passar — a partir da agenda do ge.
 *
 * POR QUE ISTO EXISTE: era a única parte do painel que dependia de alguém procurar
 * anúncio em notícia, com todo o risco que isso traz (o texto da CNN de 2025 que
 * aparecia como primeiro resultado para "NFL semana 2 onde assistir"). A agenda do
 * ge publica a mesma informação em JSON estruturado, com os times, a rodada e a lista
 * de onde assistir. É a grade dos próprios detentores, não a interpretação de alguém.
 *
 * O QUE ELA COBRE: uma janela de cinco dias a partir de hoje. Como a escolha dos jogos
 * de domingo à tarde sai entre terça e quinta, rodar todo dia pega tudo a tempo.
 * Fora dessa janela quem responde são as regras fixas (aplicar-regras-br.mjs).
 *
 * PRECEDÊNCIA ao gravar em dados/canais-br.json:
 *   confirmação manual  >  agenda do ge  >  regra fixa
 * Nunca sobrescreve o que uma pessoa confirmou à mão.
 */
import { setDefaultResultOrder } from "node:dns";
import { lerJson, gravarJson, agoraIso, sigla, buscarTexto } from "./lib/comum.mjs";

// Em rede com IPv6 o globo.com não responde no AAAA e o fetch do Node fica pendurado
// até estourar o tempo. Forçar IPv4 resolve, e no runner do Actions é indiferente.
setDefaultResultOrder("ipv4first");

const URL_AGENDA = "https://ge.globo.com/agenda/";

/* Como o ge chama cada serviço → chave do nosso catálogo. O que não está aqui é de
   outro esporte ou não nos interessa (Premiere, Cartola, Globo, Paramount+). */
const CANAL_DE = {
  "sportv": "sportv",
  "ge tv": "getv",
  "disney+": "espn",     // a ESPN Brasil aparece na agenda como Disney+
  "espn": "espn",
  "netflix": "netflix",
  "prime vídeo": "gamepass",
  "prime video": "gamepass"
};

/** Percorre um JSON a partir de um "{", respeitando aspas e escapes, e devolve o objeto. */
function objetoEm(texto, inicio) {
  let profundidade = 0, dentroDeAspas = false, escapado = false;
  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i];
    if (escapado) { escapado = false; continue; }
    if (c === "\\") { escapado = true; continue; }
    if (c === '"') { dentroDeAspas = !dentroDeAspas; continue; }
    if (dentroDeAspas) continue;
    if (c === "{") profundidade++;
    else if (c === "}") {
      profundidade--;
      if (profundidade === 0) {
        try { return JSON.parse(texto.slice(inicio, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

/** A sigla do time está no nome do arquivo do escudo: .../BUF.svg */
function siglaDe(time) {
  const m = /\/([A-Z]{2,3})\.svg$/.exec(time?.badgeSvg || "");
  return m ? sigla(m[1]) : null;
}

const html = await buscarTexto(URL_AGENDA);

const jogos = [];
const marcador = '{"__typename":"MatchEventKind"';
for (let i = html.indexOf(marcador); i !== -1; i = html.indexOf(marcador, i + 1)) {
  const evento = objetoEm(html, i);
  const m = evento?.match;
  if (!m || m.phase?.championshipEdition?.championship?.name !== "NFL") continue;

  const mandante = siglaDe(m.firstContestant);
  const visitante = siglaDe(m.secondContestant);
  if (!mandante || !visitante || !m.round) continue;

  const canais = [...new Set((m.liveWatchSources || [])
    .map(f => CANAL_DE[(f.name || "").trim().toLowerCase()])
    .filter(Boolean))];

  jogos.push({ semana: m.round, mandante, visitante, canais, data: m.startDate, hora: m.startHour });
}

if (!jogos.length) {
  console.log("nenhum jogo da NFL na janela da agenda — nada a fazer");
  process.exit(0);
}

/* Confere cada jogo contra a temporada antes de gravar: confronto que não existe na
   nossa tabela é sinal de que algo mudou de lugar, e não de que a agenda está certa. */
const temporada = lerJson("dados/temporada.json");
const daTemporada = new Map();
for (const s of temporada.semanas) {
  for (const j of s.jogos) {
    if (!j.aDefinir) daTemporada.set(`${j.semana}:${j.visitante}@${j.mandante}`, j);
  }
}

const grade = lerJson("dados/canais-br.json", { atualizadoEm: "", jogos: {} });
const times = lerJson("dados/times.json", {});
const hoje = agoraIso().slice(0, 10);
const mudancas = [];
let novos = 0, confirmados = 0, semCanal = 0, ignorados = 0, manuais = 0;

for (const g of jogos) {
  const chave = `${g.semana}:${g.visitante}@${g.mandante}`;
  if (!daTemporada.has(chave)) {
    console.log(`  ignorado: ${chave} não existe em temporada.json (${g.data} ${g.hora})`);
    ignorados++;
    continue;
  }
  if (!g.canais.length) { semCanal++; continue; }

  const atual = grade.jogos[chave];
  const origemManual = atual && !/^(regra fixa|agenda ge)/.test(atual.fonte || "");
  if (origemManual) { manuais++; continue; }

  const jaIgual = atual && atual.canais.join() === g.canais.join() && /^agenda ge/.test(atual.fonte || "");
  if (!jaIgual) {
    const nome = s => times[s]?.apelido || s;
    mudancas.push({
      tipo: atual ? "canal alterado" : "canal confirmado",
      jogo: `${nome(g.visitante)} @ ${nome(g.mandante)}`,
      rotulo: `Semana ${g.semana}`,
      canais: g.canais.join(", "),
      de: atual ? atual.canais.join(", ") : undefined
    });
  }
  grade.jogos[chave] = {
    fase: "regular", semana: g.semana, visitante: g.visitante, mandante: g.mandante,
    canais: g.canais,
    fonte: "agenda ge.globo",
    url: URL_AGENDA,
    checadoEm: hoje,
    confianca: "confirmado"
  };
  if (jaIgual) confirmados++; else novos++;
}

grade.atualizadoEm = hoje;
gravarJson("dados/canais-br.json", grade);

/* Entra no mesmo log que o sync da ESPN alimenta: descobrir que um jogo caiu no SporTV
   é exatamente o tipo de novidade que o bloco "O que mudou" do painel existe para contar. */
if (mudancas.length) {
  const log = lerJson("dados/mudancas.json", { entradas: [] });
  log.entradas.unshift({ quando: agoraIso(), origem: "sync-grade-br", mudancas });
  log.entradas = log.entradas.slice(0, 200);
  gravarJson("dados/mudancas.json", log);
}

console.log(`agenda do ge: ${jogos.length} jogo(s) da NFL na janela`);
console.log(`  ${novos} gravado(s) ou alterado(s) · ${confirmados} já estavam iguais`);
console.log(`  ${semCanal} ainda sem canal anunciado · ${manuais} preservado(s) por confirmação manual · ${ignorados} ignorado(s)`);
