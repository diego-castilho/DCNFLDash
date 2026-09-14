/**
 * Portão de qualidade dos dados. Roda no CI a cada push e PR, e localmente
 * antes de qualquer commit. Commit que não passa aqui não vai para o painel.
 *
 * As regras existem porque cada uma delas já falhou na versão anterior do
 * painel (ver docs/DADOS.md > "Por que cada regra existe").
 */
import { lerJson } from "./lib/comum.mjs";

const erros = [];
const avisos = [];
const erro = m => erros.push(m);
const aviso = m => avisos.push(m);

const temporada = lerJson("dados/temporada.json");
const times = lerJson("dados/times.json");
const canais = lerJson("dados/canais.json");
const gradeBr = lerJson("dados/canais-br.json");

if (!temporada) erro("dados/temporada.json não existe ou não é JSON válido");
if (!times) erro("dados/times.json não existe ou não é JSON válido");
if (!canais) erro("dados/canais.json não existe ou não é JSON válido");
if (!gradeBr) erro("dados/canais-br.json não existe ou não é JSON válido");
if (erros.length) { console.error(erros.map(e => `ERRO  ${e}`).join("\n")); process.exit(1); }

// ---- temporada ---------------------------------------------------------
const ids = new Set();
const chavesJogo = new Set();
let finais = 0, agendados = 0, andamento = 0;

for (const s of temporada.semanas) {
  for (const j of s.jogos) {
    const ref = j.aDefinir ? `${j.rotulo} (confronto a definir)` : `${j.rotulo} ${j.visitante} @ ${j.mandante}`;

    if (ids.has(j.id)) erro(`id de jogo duplicado: ${j.id} (${ref})`);
    ids.add(j.id);
    chavesJogo.add(`${j.fase}:${j.semana}:${j.visitante}@${j.mandante}`);

    if (!j.aDefinir) {
      if (!times[j.visitante]) erro(`sigla desconhecida "${j.visitante}" em ${ref}`);
      if (!times[j.mandante]) erro(`sigla desconhecida "${j.mandante}" em ${ref}`);
    } else if (j.estado !== "agendado") {
      erro(`${ref} está sem times mas o estado é "${j.estado}"`);
    }
    if (Number.isNaN(Date.parse(j.kickoff))) erro(`kickoff inválido em ${ref}: ${j.kickoff}`);
    if (!["agendado", "andamento", "final", "adiado"].includes(j.estado)) erro(`estado inválido em ${ref}: ${j.estado}`);

    // A regra que mais importa: placar é privilégio de jogo encerrado.
    if (j.placar && j.estado !== "final") erro(`${ref} tem placar mas o estado é "${j.estado}"`);
    if (!j.placar && j.estado === "final") erro(`${ref} está encerrado e não tem placar`);
    if (j.placar && j.parcial) erro(`${ref} tem placar e parcial ao mesmo tempo`);
    if (j.parcial && j.estado !== "andamento") erro(`${ref} tem parcial mas o estado é "${j.estado}"`);
    if (j.placar && (!Number.isInteger(j.placar.visitante) || !Number.isInteger(j.placar.mandante)))
      erro(`placar não inteiro em ${ref}`);

    if (j.estado === "final") finais++;
    else if (j.estado === "andamento") andamento++;
    else agendados++;
  }
}

if (Number.isNaN(Date.parse(temporada.atualizadoEm))) erro("temporada.atualizadoEm não é uma data válida");
if (temporada.totalJogos !== ids.size) erro(`totalJogos (${temporada.totalJogos}) não bate com os jogos presentes (${ids.size})`);
if (ids.size < 270) aviso(`só ${ids.size} jogos na temporada — esperado ~285 com playoffs`);

if (!temporada.verificadoEm) erro("temporada.json não tem verificadoEm — de que execução do sync veio?");
const idadeDias = (Date.now() - Date.parse(temporada.verificadoEm + "T12:00:00-03:00")) / 864e5;
if (idadeDias > 2) aviso(`o sync não roda há ${Math.round(idadeDias)} dia(s) — verificar o workflow`);

// ---- grade brasileira --------------------------------------------------
for (const [chave, g] of Object.entries(gradeBr.jogos || {})) {
  const ref = `grade br ${chave}`;
  const fase = g.fase || "regular";
  if (!chavesJogo.has(`${fase}:${g.semana}:${g.visitante}@${g.mandante}`))
    erro(`${ref} aponta para um confronto que não existe na temporada (${g.visitante} @ ${g.mandante}, semana ${g.semana})`);
  for (const c of g.canais || []) if (!canais[c]) erro(`${ref} usa canal desconhecido "${c}"`);
  if (!g.canais?.length) erro(`${ref} não tem nenhum canal`);
  if (!["confirmado", "provavel"].includes(g.confianca)) erro(`${ref} tem confianca inválida "${g.confianca}"`);
  if (Number.isNaN(Date.parse(g.checadoEm))) erro(`${ref} tem checadoEm inválido "${g.checadoEm}"`);
  if (g.confianca === "confirmado" && !g.fonte) erro(`${ref} está confirmado mas não diz a fonte`);
  if (g.confianca === "provavel") aviso(`${ref} está marcado como provável — revisar antes da rodada`);
}

// ---- catálogos ---------------------------------------------------------
for (const [sig, t] of Object.entries(times)) {
  if (!t.conferencia || !t.divisao) erro(`time ${sig} sem conferência/divisão`);
  if (!t.escudo) aviso(`time ${sig} sem escudo`);
}

// ---- resultado ---------------------------------------------------------
console.log(`jogos: ${ids.size} (${finais} encerrados, ${andamento} em andamento, ${agendados} agendados)`);
console.log(`grade br: ${Object.keys(gradeBr.jogos || {}).length} jogos com canal definido`);
for (const a of avisos) console.log(`AVISO ${a}`);
for (const e of erros) console.error(`ERRO  ${e}`);
if (erros.length) { console.error(`\n${erros.length} erro(s) — dados rejeitados`); process.exit(1); }
console.log("\ndados validados");
