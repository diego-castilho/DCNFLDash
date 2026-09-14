/**
 * Sincroniza a temporada a partir da API pública de scoreboard da ESPN.
 *
 * O QUE FAZ .... reescreve dados/temporada.json com confrontos, kickoff (UTC),
 *               estádio, emissora nos EUA, status e placar.
 * O QUE NÃO FAZ  não toca em dados/canais-br.json. A grade brasileira não tem
 *               API e é responsabilidade da tarefa do Claude (docs/OPERACAO.md).
 *
 * REGRA DE OURO: placar só entra em jogo com status.type.completed === true.
 *               Jogo em andamento recebe `parcial` (texto) e placar null.
 *               Jogo agendado não recebe nem um nem outro.
 *
 * Toda alteração de horário, data ou confronto é registrada em dados/mudancas.json,
 * que é o que alimenta o bloco "o que mudou" do painel e o resumo da tarefa.
 */
import { TEMPORADA, sigla, lerJson, gravarJson, agoraIso, diaBrasilia, buscarJson, emissorasDe, pacoteDe } from "./lib/comum.mjs";

const BASE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
const FASES = [
  { seasontype: 2, semanas: 18, fase: "regular" },
  { seasontype: 3, semanas: 5,  fase: "playoffs" }
];
const NOMES_PLAYOFF = { 1: "Wild Card", 2: "Divisional", 3: "Final de Conferência", 4: "Pro Bowl", 5: "Super Bowl" };

function estadoDe(status) {
  const n = status?.type?.name || "";
  if (status?.type?.completed) return "final";
  if (n === "STATUS_SCHEDULED") return "agendado";
  if (n === "STATUS_POSTPONED" || n === "STATUS_CANCELED") return "adiado";
  return "andamento";
}

function normalizarJogo(ev, fase, semana) {
  const comp = ev.competitions?.[0];
  if (!comp) return null;
  const casa = comp.competitors.find(c => c.homeAway === "home");
  const fora = comp.competitors.find(c => c.homeAway === "away");
  if (!casa || !fora) return null;

  const estado = estadoDe(comp.status);
  // Os confrontos de playoff existem no calendário antes de haver classificados:
  // a ESPN devolve "TBD" nos dois lados. O jogo é mantido (a data e a janela de
  // transmissão importam), mas sem time — ver docs/DADOS.md.
  const aDefinir = fora.team.abbreviation === "TBD" || casa.team.abbreviation === "TBD";
  const jogo = {
    id: ev.id,
    fase,
    semana,
    rotulo: fase === "playoffs" ? (NOMES_PLAYOFF[semana] || `Playoffs ${semana}`) : `Semana ${semana}`,
    aDefinir,
    visitante: aDefinir ? null : sigla(fora.team.abbreviation),
    mandante: aDefinir ? null : sigla(casa.team.abbreviation),
    kickoff: ev.date,                    // ISO em UTC — a conversão para Brasília é feita no painel
    // A NFL publica alguns jogos de fim de temporada sem horário fechado ("Flex Game:
    // 12/26 or 12/27"). A ESPN marca esses com timeValid=false e devolve um horário
    // de fachada — o painel precisa mostrar "data a definir", não o horário falso.
    horarioAConfirmar: comp.timeValid === false,
    estado,                              // agendado | andamento | final | adiado
    placar: null,
    parcial: null,
    local: {
      estadio: comp.venue?.fullName || "",
      cidade: comp.venue?.address?.city || "",
      uf: comp.venue?.address?.state || "",
      pais: comp.venue?.address?.country || "USA"
    },
    emissoraEua: (comp.broadcasts?.[0]?.names || []).join("/"),
    // Chaves do catálogo dados/emissoras-eua.json — para o painel mostrar a marca
    // da emissora americana, útil quando o Diego assiste de fora do Brasil.
    emissoras: emissorasDe((comp.broadcasts?.[0]?.names || []).join("/")),
    // TNF | SNF | MNF — decide tanto a marca no painel quanto a regra fixa da grade brasileira
    pacote: pacoteDe(ev.date, (comp.broadcasts?.[0]?.names || []).join("/")),
    nota: comp.notes?.[0]?.headline || ""
  };

  if (estado === "final") {
    jogo.placar = { visitante: Number(fora.score), mandante: Number(casa.score) };
  } else if (estado === "andamento") {
    jogo.parcial = comp.status?.type?.shortDetail || "em andamento";
  }
  return jogo;
}

const refJogo = j => j.aDefinir ? `${j.rotulo} (a definir)` : `${j.visitante} @ ${j.mandante}`;

function compararComAnterior(anterior, novos) {
  if (!anterior) return [];
  const antes = new Map();
  for (const s of anterior.semanas || []) for (const j of s.jogos) antes.set(j.id, j);

  const mudancas = [];
  for (const j of novos) {
    const a = antes.get(j.id);
    if (!a) { mudancas.push({ tipo: "jogo novo", id: j.id, jogo: refJogo(j), rotulo: j.rotulo }); continue; }
    if (a.kickoff !== j.kickoff) {
      mudancas.push({ tipo: "horário alterado", id: j.id, jogo: refJogo(j), rotulo: j.rotulo, de: a.kickoff, para: j.kickoff });
    }
    if (a.estado !== "final" && j.estado === "final") {
      mudancas.push({ tipo: "placar final", id: j.id, jogo: refJogo(j), rotulo: j.rotulo, placar: `${j.placar.visitante} x ${j.placar.mandante}` });
    }
  }
  return mudancas;
}

const anterior = lerJson("dados/temporada.json");
const semanas = [];
const todos = [];

for (const { seasontype, semanas: qtd, fase } of FASES) {
  for (let n = 1; n <= qtd; n++) {
    const url = `${BASE}?dates=${TEMPORADA}&seasontype=${seasontype}&week=${n}`;
    const dados = await buscarJson(url);
    const jogos = (dados.events || []).map(ev => normalizarJogo(ev, fase, n)).filter(Boolean);
    if (!jogos.length) continue;
    jogos.sort((a, b) => a.kickoff.localeCompare(b.kickoff) || (a.mandante || "").localeCompare(b.mandante || ""));
    semanas.push({
      fase, numero: n,
      rotulo: jogos[0].rotulo,
      inicio: jogos[0].kickoff,
      fim: jogos[jogos.length - 1].kickoff,
      jogos
    });
    todos.push(...jogos);
    process.stdout.write(`${fase} ${n}: ${jogos.length} jogos\n`);
  }
}

if (todos.length < 200) throw new Error(`temporada incompleta (${todos.length} jogos) — abortando para não sobrescrever dados bons`);

const mudancas = compararComAnterior(anterior, todos);

// Dois carimbos com propósitos diferentes:
//   atualizadoEm — quando o CONTEÚDO mudou pela última vez
//   verificadoEm — o dia em que o sync rodou e confirmou que está tudo certo
// Sem essa separação o sync gera commit a cada 30 minutos só porque o relógio
// andou. Com ela, commita quando algo muda — ou uma vez por dia, no máximo.
const mudouConteudo = !anterior || JSON.stringify(anterior.semanas) !== JSON.stringify(semanas);
const saida = {
  temporada: TEMPORADA,
  atualizadoEm: mudouConteudo ? agoraIso() : anterior.atualizadoEm,
  verificadoEm: diaBrasilia(agoraIso()),
  fonte: "ESPN scoreboard API",
  totalJogos: todos.length,
  semanas
};
gravarJson("dados/temporada.json", saida);

// O arquivo é sempre gravado, mesmo vazio: o painel o consome direto e um 404
// no console é ruído que esconde erro de verdade.
const log = lerJson("dados/mudancas.json", { entradas: [] });
if (mudancas.length) {
  log.entradas.unshift({ quando: agoraIso(), origem: "sync-espn", mudancas });
  log.entradas = log.entradas.slice(0, 200);
}
gravarJson("dados/mudancas.json", log);

console.log(`\n${todos.length} jogos · ${mudouConteudo ? "conteúdo alterado" : "nada mudou"} · ${mudancas.length} mudança(s) registrada(s)`);
