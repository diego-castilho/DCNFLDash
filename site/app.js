/* DCNFLDash — camada de apresentação.
 *
 * Este arquivo NÃO contém dado nenhum. Tudo vem de dados/*.json, que são
 * gerados e validados fora daqui (scripts/sync-espn.mjs e scripts/validar.mjs).
 * Se um número parecer errado no painel, o lugar de olhar é o JSON, não aqui.
 *
 * Tudo que é derivado — campanha, classificação, radar de transmissão — é
 * calculado no navegador a partir de dados/temporada.json. Nenhum número
 * duplicado em arquivo, nenhum risco de um ficar velho em relação ao outro.
 */

const DURACAO = 3.4 * 36e5;                  // duração estimada de um jogo
const FUSO = "America/Sao_Paulo";
const $ = s => document.querySelector(s);

/* cache: "no-cache" força o navegador a revalidar com o servidor antes de usar a
   cópia guardada. Sem isso o painel podia mostrar dados de até dez minutos atrás
   (o cache do GitHub Pages) logo depois de um sync — e ninguém consegue distinguir
   "cache velho" de "sync quebrado" olhando a tela. Revalidação é barata: quando
   nada mudou o servidor responde 304, sem corpo. */
const buscarDados = (arquivo, padrao) =>
  fetch(`dados/${arquivo}`, { cache: "no-cache" })
    .then(r => r.json())
    .catch(e => { if (padrao === undefined) throw e; return padrao; });

const [temporada, times, canais, emissoras, pacotes, conferencias, gradeBr, mudancas] = await Promise.all([
  buscarDados("temporada.json"),
  buscarDados("times.json"),
  buscarDados("canais.json"),
  buscarDados("emissoras-eua.json"),
  buscarDados("pacotes.json"),
  buscarDados("conferencias.json"),
  buscarDados("canais-br.json"),
  buscarDados("mudancas.json", { entradas: [] })
]);

const JOGOS = temporada.semanas.flatMap(s => s.jogos);
const ME = "PIT";
const MINHA_CONF = "AFC";
const MINHA_DIV = "Norte";

/* ---------- utilidades ------------------------------------------------- */
const time = s => times[s] || { sigla: s, apelido: s, escudo: "", cor: "#2E3440", corTexto: "#fff" };
const escudo = s => `<img src="${time(s).escudo}" alt="" loading="lazy">`;
const dia = iso => new Date(iso).toLocaleDateString("sv-SE", { timeZone: FUSO });
const hora = iso => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
const dataLonga = iso => new Date(iso).toLocaleDateString("pt-BR", { timeZone: FUSO, weekday: "long", day: "2-digit", month: "2-digit" });
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
/** Diferença em dias de calendário (Brasília) — evita o "faltam 2 dias" quando é amanhã. */
const diasAte = d => Math.round(
  (Date.parse(`${dia(d)}T12:00:00-03:00`) - Date.parse(`${dia(Date.now())}T12:00:00-03:00`)) / 864e5
);

/** Estado exibido: o sync manda a verdade, mas entre dois syncs um jogo pode ter
 *  começado. Nesse caso mostramos "em andamento" sem placar — nunca um placar velho. */
function estadoVisual(j) {
  if (j.estado === "final" || j.estado === "adiado") return j.estado;
  const t = Date.parse(j.kickoff), agora = Date.now();
  if (j.estado === "andamento") return "andamento";
  if (agora >= t && agora < t + DURACAO) return "andamento";
  return "agendado";
}

/* ---------- marcas de canal --------------------------------------------- */
/* Três formas de representar um canal, nesta ordem de preferência:
   imagem → caminho SVG embutido → marca tipográfica. A imagem tem prioridade e
   cai para a marca sozinha se o arquivo não existir (ver o onerror). */
function selo(chave) {
  const c = canais[chave];
  if (!c) return "";
  // Uma marca por selo: logo OU desenho OU texto, nunca logo e texto juntos.
  if (c.logo) return `<span class="ch" title="${c.nome}"><img src="${c.logo}" alt="${c.nome}"></span>`;
  if (c.svg) return `<span class="ch" title="${c.nome}" style="background:${c.cor}22">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="${c.cor}" aria-hidden="true"><path d="${c.svg}"/></svg></span>`;
  return `<span class="ch plana" title="${c.nome}" style="background:${c.cor};color:${c.corTexto}">${c.marca || c.nome}</span>`;
}

/* As emissoras americanas vêm do Commons e a maioria é preta sobre transparente —
   invisível num fundo escuro. Por isso cada uma vai num chip claro, como num guia de
   TV impresso; as poucas que já são claras ganham `fundo: "escuro"` no catálogo. */
function seloEua(chave) {
  const e = emissoras[chave];
  if (!e) return "";
  return `<span class="eua ${e.fundo === "escuro" ? "escuro" : "claro"}" title="${e.nome} · transmissão nos EUA" style="--c:${e.cor}">
    <img src="${e.logo}" alt="${e.nome}" onerror="this.remove()"><i class="wm">${e.marca}</i></span>`;
}

/* TNF, SNF e MNF ganham coluna própria no meio do cartão, em tamanho grande: é a
   informação que diz "esse é O jogo da noite", e espremida num canto ela não dizia nada.
   Quem tem logo oficial mostra o logo; o TNF, que não tem versão livre, ganha uma marca
   desenhada aqui com o mesmo peso visual. */
function seloPacote(p, tamanho) {
  const d = pacotes[p];
  if (!d) return "";
  const conteudo = d.logo
    ? `<img src="${d.logo}" alt="${d.nome}" onerror="this.replaceWith(document.createTextNode('${p}'))">`
    : `<span class="desenhada"><i class="sigla">${d.marca}</i><i class="linha"></i><i class="noite">night</i></span>`;
  return `<span class="pct ${tamanho || ""} ${d.logo ? "com-logo" : "sem-logo"} ${d.inverter ? "inv" : ""}"
    title="${d.nome}" style="--c:${d.cor}">${conteudo}</span>`;
}

/* Liga de um time: SEMPRE conferência e divisão, no mesmo formato em todo lugar do
   painel. A versão anterior mostrava a divisão só quando os dois times eram da mesma —
   o que dava a impressão de que faltava informação em metade dos cartões. */
function seloLiga(sigla, destaque) {
  const t = times[sigla];
  if (!t) return "";
  const conf = conferencias[t.conferencia] || {};
  const marca = conf.logo
    ? `<img src="${conf.logo}" alt="${t.conferencia}" onerror="this.replaceWith(document.createTextNode('${t.conferencia}'))">`
    : `<i class="wm">${t.conferencia}</i>`;
  return `<span class="liga-chip ${destaque ? "destaque" : ""}" style="--c:${conf.cor || "#888"}"
    title="${t.conferencia} ${t.divisao}${destaque ? " · jogo de divisão" : ""}">
    ${marca}<span class="rot">${t.divisao}</span></span>`;
}

/** Coluna de liga do cartão: uma linha por time, alinhada com as linhas do confronto. */
function colunaLiga(a, b) {
  if (!times[a] || !times[b]) return "";
  const mesmaDivisao = times[a].conferencia === times[b].conferencia && times[a].divisao === times[b].divisao;
  return seloLiga(a, mesmaDivisao) + seloLiga(b, mesmaDivisao);
}

/** Cartaz e posição na conferência, para aparecer ao lado do nome do time. */
function classificacaoDe(sigla) {
  const t = TAB[sigla];
  if (!t || !t.jogos) return "";
  const conf = times[sigla]?.conferencia;
  const pos = conf ? SEEDS[conf].findIndex(x => x.sigla === sigla) + 1 : 0;
  return `<span class="clas"><span class="cartaz">${t.cartaz}</span>${pos ? `<span class="pos">${pos}º</span>` : ""}</span>`;
}

/* ---------- grade brasileira ------------------------------------------- */
const chaveJogo = j => `${j.fase || "regular"}:${j.semana}:${j.visitante}@${j.mandante}`;
const mapaBr = new Map();
for (const g of Object.values(gradeBr.jogos || {})) {
  mapaBr.set(`${g.fase || "regular"}:${g.semana}:${g.visitante}@${g.mandante}`, g);
}
const brDe = j => mapaBr.get(chaveJogo(j)) || null;
const temTvBr = j => !!brDe(j)?.canais?.length;

/* ---------- selo de frescor -------------------------------------------- */
/* O que interessa aqui é "o sync está vivo?", e não "o dado mudou?". Numa terça
   sem jogo nada muda, e isso é normal — o alarme é o sync ter parado de rodar. */
(function frescor() {
  const el = $("#frescor");
  const dias = temporada.verificadoEm ? diasAte(`${temporada.verificadoEm}T12:00:00-03:00`) * -1 : 99;
  const mudou = new Date(temporada.atualizadoEm)
    .toLocaleString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  el.textContent = dias <= 0 ? `verificado hoje · dados de ${mudou}`
    : dias === 1 ? `verificado ontem · dados de ${mudou}`
    : `sem verificar há ${dias} dias · dados de ${mudou}`;
  el.className = "frescor" + (dias > 3 ? " parado" : dias > 1 ? " velho" : "");
  el.title = `última verificação: ${temporada.verificadoEm || "desconhecida"} · última alteração de dados: ${mudou}`;
})();

/* ---------- campanha e classificação ------------------------------------ */
/* Desempate simplificado: confronto direto, depois campanha na divisão, depois
   saldo de pontos. A NFL usa uma escada bem mais longa; para acompanhar a corrida
   isso resolve, e a documentação avisa onde pode divergir (docs/DADOS.md). */
function campanhas() {
  const t = {};
  for (const s of Object.keys(times)) {
    t[s] = { sigla: s, v: 0, d: 0, e: 0, pf: 0, pc: 0, divV: 0, divD: 0, confV: 0, confD: 0, bate: {} };
  }
  for (const j of JOGOS) {
    if (j.estado !== "final" || j.aDefinir || j.fase !== "regular") continue;
    const a = t[j.visitante], b = t[j.mandante];
    if (!a || !b) continue;
    const pa = j.placar.visitante, pb = j.placar.mandante;
    a.pf += pa; a.pc += pb; b.pf += pb; b.pc += pa;
    const mesmaConf = times[j.visitante].conferencia === times[j.mandante].conferencia;
    const mesmaDiv = mesmaConf && times[j.visitante].divisao === times[j.mandante].divisao;
    if (pa === pb) {
      a.e++; b.e++;
    } else {
      const [g, p] = pa > pb ? [a, b] : [b, a];
      g.v++; p.d++;
      g.bate[p.sigla] = (g.bate[p.sigla] || 0) + 1;
      if (mesmaDiv) { g.divV++; p.divD++; }
      if (mesmaConf) { g.confV++; p.confD++; }
    }
  }
  for (const x of Object.values(t)) {
    const jogos = x.v + x.d + x.e;
    x.jogos = jogos;
    x.pct = jogos ? (x.v + x.e / 2) / jogos : 0;
    x.saldo = x.pf - x.pc;
    x.cartaz = x.e ? `${x.v}-${x.d}-${x.e}` : `${x.v}-${x.d}`;
  }
  return t;
}

const TAB = campanhas();

function ordenar(a, b) {
  if (b.pct !== a.pct) return b.pct - a.pct;
  const ab = a.bate[b.sigla] || 0, ba = b.bate[a.sigla] || 0;
  if (ab !== ba) return ba - ab;
  const pa = a.divV + a.divD ? a.divV / (a.divV + a.divD) : 0;
  const pb = b.divV + b.divD ? b.divV / (b.divV + b.divD) : 0;
  if (pa !== pb) return pb - pa;
  return b.saldo - a.saldo;
}

function seedsDaConferencia(conf) {
  const doGrupo = Object.values(TAB).filter(x => times[x.sigla].conferencia === conf);
  const porDivisao = {};
  for (const x of doGrupo) (porDivisao[times[x.sigla].divisao] ||= []).push(x);
  const campeoes = Object.values(porDivisao).map(l => [...l].sort(ordenar)[0]).sort(ordenar);
  const resto = doGrupo.filter(x => !campeoes.includes(x)).sort(ordenar);
  return [...campeoes, ...resto];
}

const SEEDS = { AFC: seedsDaConferencia("AFC"), NFC: seedsDaConferencia("NFC") };
const MEU_SEED = SEEDS[MINHA_CONF].findIndex(x => x.sigla === ME) + 1;

/* ---------- meus jogos --------------------------------------------------- */
const MEUS = JOGOS.filter(j => j.fase === "regular" && (j.visitante === ME || j.mandante === ME))
  .sort((a, b) => a.semana - b.semana);
const BYE = (() => {
  const jogadas = new Set(MEUS.map(j => j.semana));
  for (let n = 1; n <= 18; n++) if (!jogadas.has(n)) return n;
  return null;
})();

function situacao(j) {
  const br = brDe(j);
  if (br) return { classe: "ok", canais: br.canais, texto: br.canais.map(c => canais[c]?.nome || c).join(" · ") };
  const passou = Date.now() > Date.parse(j.kickoff) + DURACAO;
  if (passou) return { classe: "fora", canais: [], texto: "ficou fora da TV brasileira" };
  if (j.local.pais !== "USA" || (j.emissoras || []).includes("nflnet"))
    return { classe: "duvida", canais: [], texto: "sem detentor definido no Brasil" };
  return { classe: "risco", canais: [], texto: "depende da escolha da rodada" };
}

/* ---------- hero --------------------------------------------------------- */
(function hero() {
  const alvo = MEUS.find(j => Date.parse(j.kickoff) + DURACAO > Date.now()) || MEUS[MEUS.length - 1];
  if (!alvo) return;
  $("#hero").hidden = false;

  const casa = alvo.mandante === ME;
  const adv = casa ? alvo.visitante : alvo.mandante;
  const bloco = s => `<div class="hero-time">${escudo(s)}<div>
      <div class="nm">${time(s).apelido}</div>
      <div class="sg">${s} ${classificacaoDe(s)}</div></div></div>`;
  $("#heroMat").innerHTML = bloco(ME) + `<span class="hero-vs">${casa ? "recebe" : "visita"}</span>` + bloco(adv);

  $("#heroRotulo").innerHTML = `${alvo.rotulo} · ${casa ? "em Pittsburgh" : "fora de casa"}`;
  $("#heroSelos").innerHTML = seloPacote(alvo.pacote, "grande") + seloLiga(ME) + seloLiga(adv);
  $("#heroQuando").textContent = alvo.horarioAConfirmar
    ? `${alvo.nota || "data ainda não fechada"}`
    : `${cap(dataLonga(alvo.kickoff))} · ${hora(alvo.kickoff)} (Brasília)`;
  $("#heroLocal").textContent = [alvo.local.estadio, alvo.local.cidade].filter(Boolean).join(" · ");

  const br = brDe(alvo);
  $("#heroOnde").innerHTML = br
    ? `<span class="selos">${br.canais.map(selo).join("")}</span>`
    : `<span style="color:var(--texto2)">${situacao(alvo).texto}</span>`;
  $("#heroEua").innerHTML = (alvo.emissoras || []).length
    ? `<span class="selos">${alvo.emissoras.map(seloEua).join("")}</span>`
    : `<span style="color:var(--texto3)">—</span>`;

  const tick = () => {
    const falta = Date.parse(alvo.kickoff) - Date.now();
    const estado = estadoVisual(alvo);
    if (estado === "andamento") {
      $("#hero").classList.add("vivo");
      $("#heroTitulo").innerHTML = `<span class="pulso"></span> Pittsburgh jogando agora`;
      $("#heroContagem").innerHTML = alvo.parcial || "ao vivo";
      $("#heroContagemRot").textContent = "bola rolando";
      return;
    }
    if (estado === "final") {
      const meu = alvo.mandante === ME ? alvo.placar.mandante : alvo.placar.visitante;
      const dele = alvo.mandante === ME ? alvo.placar.visitante : alvo.placar.mandante;
      $("#heroTitulo").textContent = meu > dele ? "Vitória do Pittsburgh" : meu < dele ? "Derrota do Pittsburgh" : "Empate";
      $("#heroContagem").textContent = `${meu} x ${dele}`;
      $("#heroContagemRot").textContent = "resultado final";
      return;
    }
    $("#heroTitulo").textContent = "Próximo jogo";
    if (alvo.horarioAConfirmar) { $("#heroContagem").textContent = "—"; $("#heroContagemRot").textContent = "horário a confirmar"; return; }
    const d = Math.floor(falta / 864e5), h = Math.floor(falta / 36e5) % 24, m = Math.floor(falta / 6e4) % 60;
    $("#heroContagem").textContent = d > 0 ? `${d}d ${h}h` : `${h}h ${String(m).padStart(2, "0")}min`;
    $("#heroContagemRot").textContent = "para o kickoff";
  };
  tick();
  setInterval(tick, 30000);
})();

/* ---------- números ------------------------------------------------------ */
(function numeros() {
  const meu = TAB[ME];
  const jogados = MEUS.filter(j => j.estado === "final");
  const comTv = MEUS.filter(j => temTvBr(j)).length;
  const fora = MEUS.filter(j => situacao(j).classe === "fora").length;
  const pendentes = MEUS.filter(j => ["risco", "duvida"].includes(situacao(j).classe)).length;

  $("#numeros").innerHTML = `
    <div class="num"><b>${meu.cartaz}</b><span>campanha na temporada</span></div>
    <div class="num"><b class="neutro">${MEU_SEED ? MEU_SEED + "º" : "—"}</b><span>posição na AFC hoje</span></div>
    <div class="num"><b class="bom">${comTv}</b><span>jogos confirmados na TV brasileira</span></div>
    <div class="num"><b class="${fora ? "mau" : ""}">${fora}</b><span>já ficaram fora da TV brasileira</span></div>
    <div class="num"><b>${pendentes}</b><span>ainda dependem da escolha da rodada</span></div>
    <div class="num"><b>${jogados.length}/${MEUS.length}</b><span>jogos disputados</span></div>`;
})();

/* ---------- corrida dos playoffs ----------------------------------------- */
function tabelaDivisao(conf, divisao) {
  const linhas = Object.values(TAB)
    .filter(x => times[x.sigla].conferencia === conf && times[x.sigla].divisao === divisao)
    .sort(ordenar);
  return `
    <tr><th>Time</th><th>V-D</th><th>Div</th><th>Saldo</th></tr>
    ${linhas.map(x => `
      <tr class="${x.sigla === ME ? "pit" : ""}">
        <td>${escudo(x.sigla)} ${time(x.sigla).apelido}</td>
        <td>${x.cartaz}</td>
        <td>${x.divV}-${x.divD}</td>
        <td>${x.saldo > 0 ? "+" : ""}${x.saldo}</td>
      </tr>`).join("")}`;
}

function listaSeeds(conf) {
  return SEEDS[conf].slice(0, 10).map((x, i) => `
    <li class="${x.sigla === ME ? "pit" : ""} ${i === 7 ? "corte" : ""}">
      ${escudo(x.sigla)} <span class="tn">${time(x.sigla).apelido}</span>
      <span class="rec">${x.cartaz}</span>
    </li>`).join("");
}

function liderancasDaConferencia(conf) {
  const porDivisao = {};
  for (const x of Object.values(TAB).filter(t => times[t.sigla].conferencia === conf)) {
    (porDivisao[times[x.sigla].divisao] ||= []).push(x);
  }
  return `
    <tr><th>Divisão</th><th>Líder</th><th>V-D</th></tr>
    ${["Norte", "Sul", "Leste", "Oeste"].map(d => {
      const lider = [...(porDivisao[d] || [])].sort(ordenar)[0];
      if (!lider) return "";
      return `<tr><td class="dv">${conf} ${d}</td>
        <td class="lider">${escudo(lider.sigla)} ${time(lider.sigla).apelido}</td>
        <td>${lider.cartaz}</td></tr>`;
    }).join("")}`;
}

(function classificacao() {
  $("#tabDivisao").innerHTML = tabelaDivisao(MINHA_CONF, MINHA_DIV);
  $("#seedsAfc").innerHTML = listaSeeds("AFC");
  $("#seedsNfc").innerHTML = listaSeeds("NFC");
  $("#tabNfc").innerHTML = liderancasDaConferencia("NFC");

  // De olho: jogos da rodada corrente entre times da AFC com campanha vizinha à minha.
  const s = semanaCorrente();
  const meuPct = TAB[ME].pct;
  const interessa = (temporada.semanas.find(x => x.fase === s.fase && x.numero === s.numero)?.jogos || [])
    .filter(j => !j.aDefinir && j.visitante !== ME && j.mandante !== ME)
    .filter(j => times[j.visitante]?.conferencia === "AFC" && times[j.mandante]?.conferencia === "AFC")
    .filter(j => Math.abs(TAB[j.visitante].pct - meuPct) <= 0.25 || Math.abs(TAB[j.mandante].pct - meuPct) <= 0.25)
    .slice(0, 6);

  $("#deOlhoSub").textContent = interessa.length
    ? "Confrontos da AFC que mexem na sua posição nesta rodada."
    : "Nenhum confronto da AFC próximo da sua campanha nesta rodada.";
  $("#deOlho").innerHTML = interessa.map(j => `
    <li>${escudo(j.visitante)} ${time(j.visitante).apelido} <span style="color:var(--texto3)">@</span>
        ${escudo(j.mandante)} ${time(j.mandante).apelido}</li>`).join("");
})();

/* ---------- grade da rodada ---------------------------------------------- */
function semanaCorrente() {
  const agora = Date.now();
  const s = temporada.semanas.find(x => agora <= Date.parse(x.fim) + DURACAO);
  return s || temporada.semanas[temporada.semanas.length - 1];
}

function linhaTime(sigla, venceu, perdeu) {
  return `<div class="time ${venceu ? "venceu" : ""} ${perdeu ? "perdeu" : ""}">
    ${sigla ? escudo(sigla) : `<span class="vazio"></span>`}
    <span class="nm">${sigla ? time(sigla).apelido : "a definir"}</span>
    ${sigla ? classificacaoDe(sigla) : `<span class="clas"></span>`}
  </div>`;
}

/* O resultado ganhou coluna própria: espremido entre campanha e liga, ele era o
   dado mais importante do cartão e o menos visível. Aqui os dois números ficam num
   bloco só, em corpo grande, alinhados com as duas linhas do confronto. */
function colunaResultado(j, fim, vV, vM) {
  if (!fim) return `<div class="resultado vazio"><span class="p">–</span><span class="p">–</span></div>`;
  return `<div class="resultado">
    <span class="p ${vV ? "ganhou" : ""}">${j.placar.visitante}</span>
    <span class="p ${vM ? "ganhou" : ""}">${j.placar.mandante}</span>
  </div>`;
}

/* Cabeçalho de colunas: o cartão do jogo é uma tabela disfarçada, e nomear as colunas
   uma vez no topo evita ter que adivinhar o que é cada número. */
const CABECALHO_GRADE = `
  <div class="cab-grade" aria-hidden="true">
    <span>Horário</span>
    <span class="conf"><span>Confronto</span><span class="c">Camp.</span></span>
    <span class="r">Resultado</span>
    <span>Liga</span>
    <span>Destaque</span>
    <span class="cn"><span>Brasil</span><span>EUA</span></span>
  </div>`;

function cartaoJogo(j) {
  const estado = estadoVisual(j);
  const fim = estado === "final";
  const br = brDe(j);
  const semTv = !br;
  const vV = fim && j.placar.visitante > j.placar.mandante;
  const vM = fim && j.placar.mandante > j.placar.visitante;
  const ehMeu = j.visitante === ME || j.mandante === ME;
  const passou = Date.now() > Date.parse(j.kickoff) + DURACAO;

  const estadoTxt =
    estado === "andamento" ? `<span class="e vivo"><span class="pulso"></span> ${j.parcial || "ao vivo"}</span>`
    : fim ? `<span class="e fim">encerrado</span>`
    : estado === "adiado" ? `<span class="e">adiado</span>`
    : j.horarioAConfirmar ? `<span class="e">a confirmar</span>`
    : `<span class="e">Brasília</span>`;

  const selosBr = br ? br.canais.map(selo).join("")
    : `<span class="ch tbd">${passou ? "sem TV brasileira" : "a definir"}</span>`;
  const gamepass = !br || !br.canais.includes("gamepass") ? selo("gamepass") : "";
  const selosEua = (j.emissoras || []).map(seloEua).join("");

  const etiquetas = [
    j.nota ? `<span class="etq">${j.nota}</span>` : "",
    j.local.pais !== "USA" ? `<span class="etq">${j.local.cidade}, fora dos EUA</span>` : ""
  ].filter(Boolean).join("");

  const estiloPacote = j.pacote && pacotes[j.pacote] ? `style="--pc:${pacotes[j.pacote].cor}"` : "";

  return `<div class="jogo ${ehMeu ? "pit" : ""} ${semTv ? "semtv" : ""} ${estado === "andamento" ? "vivo" : ""} ${j.pacote ? "primetime" : ""}" data-br="${semTv ? 0 : 1}" ${estiloPacote}>
    <div class="quando"><span class="h">${j.horarioAConfirmar ? "--:--" : hora(j.kickoff)}</span>${estadoTxt}</div>
    <div class="mat">
      ${linhaTime(j.visitante, vV, fim && !vV)}
      ${linhaTime(j.mandante, vM, fim && !vM)}
      ${etiquetas ? `<div class="etqs">${etiquetas}</div>` : ""}
    </div>
    ${colunaResultado(j, fim, vV, vM)}
    <div class="liga">${j.aDefinir ? "" : colunaLiga(j.visitante, j.mandante)}</div>
    <div class="destaque">${seloPacote(j.pacote, "grande")}</div>
    <div class="chs">
      <div class="col br">${selosBr}${gamepass}</div>
      <div class="col eua">${selosEua || `<span class="vazio-eua">—</span>`}</div>
    </div>
  </div>`;
}

function renderSemana(s) {
  const porDia = {};
  for (const j of s.jogos) (porDia[j.horarioAConfirmar ? "a definir" : dia(j.kickoff)] ||= []).push(j);

  const semCanal = s.jogos.filter(j => !brDe(j) && !j.aDefinir);
  const pendentes = semCanal.filter(j => Date.now() < Date.parse(j.kickoff) + DURACAO).length;
  const perdidos = semCanal.length - pendentes;
  const recado = pendentes
    ? `${pendentes} jogo(s) desta rodada ainda sem canal brasileiro definido. A grade de domingo à tarde costuma ser anunciada entre terça e quinta.`
    : perdidos
      ? `${perdidos} jogo(s) desta rodada não passaram em nenhum canal brasileiro.`
      : "";
  const nota = recado ? `<div class="nota"><span>→</span><span>${recado}</span></div>` : "";

  $("#grade").innerHTML = nota + CABECALHO_GRADE + Object.entries(porDia).map(([d, jogos]) => `
    <div class="dia">
      <h3>${d === "a definir" ? "Data a definir" : cap(dataLonga(jogos[0].kickoff))}</h3>
      <span class="ln"></span>
      <span class="ct">${jogos.length} ${jogos.length > 1 ? "jogos" : "jogo"}</span>
    </div>
    ${jogos.map(cartaoJogo).join("")}`).join("");
  filtrar();
}

function filtrar() {
  const so = $("#soBr").checked;
  document.querySelectorAll(".jogo").forEach(el => {
    el.style.display = so && el.dataset.br === "0" ? "none" : "";
  });
}
$("#soBr").addEventListener("change", filtrar);

(function abas() {
  const atual = semanaCorrente();
  const nav = $("#semanas");
  temporada.semanas.forEach(s => {
    const b = document.createElement("button");
    b.textContent = s.fase === "playoffs" ? s.rotulo : `S${s.numero}`;
    b.title = s.rotulo;
    b.setAttribute("role", "tab");
    const ehAtual = s.fase === atual.fase && s.numero === atual.numero;
    b.setAttribute("aria-selected", ehAtual ? "true" : "false");
    b.onclick = () => {
      nav.querySelectorAll("button").forEach(x => x.setAttribute("aria-selected", "false"));
      b.setAttribute("aria-selected", "true");
      renderSemana(s);
    };
    nav.appendChild(b);
    // scrollIntoView arrastaria a página inteira junto; aqui só a faixa de abas rola.
    if (ehAtual) requestAnimationFrame(() => {
      nav.scrollLeft = b.offsetLeft - nav.clientWidth / 2 + b.clientWidth / 2;
    });
  });
  renderSemana(atual);
})();

/* ---------- temporada do Pittsburgh -------------------------------------- */
(function temporadaPit() {
  const cartoes = [];
  for (let n = 1; n <= 18; n++) {
    if (n === BYE) {
      cartoes.push(`<div class="sem bye"><div class="n">Semana ${n}</div><div class="adv">Semana livre</div><div class="dt">bye</div></div>`);
      continue;
    }
    const j = MEUS.find(x => x.semana === n);
    if (!j) continue;
    const casa = j.mandante === ME;
    const adv = casa ? j.visitante : j.mandante;
    const s = situacao(j);
    const fim = j.estado === "final";
    const meu = fim ? (casa ? j.placar.mandante : j.placar.visitante) : null;
    const dele = fim ? (casa ? j.placar.visitante : j.placar.mandante) : null;
    const tv = s.canais.length
      ? `<div class="linha-tv"><span class="rot">BR</span><span class="selos">${s.canais.map(selo).join("")}</span></div>`
      : `<div class="linha-tv"><span class="rot">BR</span><span class="txt">${s.texto}</span></div>`;
    const eua = (j.emissoras || []).length
      ? `<div class="linha-tv"><span class="rot">EUA</span><span class="selos">${j.emissoras.map(seloEua).join("")}</span></div>` : "";
    cartoes.push(`
      <div class="sem ${s.classe} ${j.pacote ? "primetime" : ""}" ${j.pacote && pacotes[j.pacote] ? `style="--pc:${pacotes[j.pacote].cor}"` : ""}>
        <div class="n"><span>Semana ${n} · ${casa ? "em casa" : "fora"}</span> ${seloPacote(j.pacote)}</div>
        <div class="adv">${escudo(adv)} <span class="nm">${time(adv).apelido}</span></div>
        <div class="sub-adv">${seloLiga(adv, times[adv]?.conferencia === times[ME].conferencia && times[adv]?.divisao === times[ME].divisao)} ${classificacaoDe(adv)}</div>
        <div class="dt">${j.horarioAConfirmar ? "data a definir" : `${dia(j.kickoff).split("-").reverse().slice(0, 2).join("/")} · ${hora(j.kickoff)}`}</div>
        ${fim ? `<div class="res ${meu > dele ? "v" : "d"}">
          <span class="rot">${meu > dele ? "Vitória" : "Derrota"}</span>
          <span class="pl">${meu} x ${dele}</span></div>` : ""}
        ${tv}${eua}
      </div>`);
  }
  $("#temporada").innerHTML = cartoes.join("");
})();

/* ---------- radar de transmissão ----------------------------------------- */
(function radar() {
  const contagem = {};
  for (const c of Object.keys(canais)) contagem[c] = 0;
  let fora = 0;
  for (const j of MEUS) {
    const br = brDe(j);
    if (br) for (const c of br.canais) contagem[c] = (contagem[c] || 0) + 1;
    else if (situacao(j).classe === "fora") fora++;
  }
  const total = MEUS.length;
  const cartoes = Object.entries(canais)
    .filter(([k]) => k !== "gamepass")
    .map(([k, c]) => `
      <div class="rad">
        <div class="top">${selo(k)}</div>
        <b>${contagem[k] || 0}</b><span>jogos do Steelers</span>
        <div class="barra"><i style="width:${Math.round((contagem[k] || 0) / total * 100)}%"></i></div>
      </div>`);
  cartoes.push(`
    <div class="rad">
      <div class="top"><span class="nome">Sem TV brasileira</span></div>
      <b style="color:var(--vermelho)">${fora}</b><span>jogos já perdidos</span>
      <div class="barra"><i style="width:${Math.round(fora / total * 100)}%;background:var(--vermelho)"></i></div>
    </div>`);
  $("#radar").innerHTML = cartoes.join("");

  // Próxima janela de anúncio: a terça anterior ao próximo jogo sem canal.
  const alvo = MEUS.find(j => !brDe(j) && Date.parse(j.kickoff) > Date.now());
  if (!alvo) { $("#janela").textContent = "Todos os jogos futuros do Steelers já têm canal definido."; return; }
  const kickoff = new Date(alvo.kickoff);
  const terca = new Date(kickoff);
  terca.setUTCDate(terca.getUTCDate() - ((kickoff.getUTCDay() + 5) % 7 || 7));
  const dias = diasAte(terca.toISOString());
  const adv = alvo.mandante === ME ? alvo.visitante : alvo.mandante;
  $("#janela").innerHTML = dias > 0
    ? `O canal de <b>${time(ME).apelido} × ${time(adv).apelido}</b> (${alvo.rotulo}) ainda não foi anunciado. A grade dessa rodada costuma sair a partir de <b>${terca.toLocaleDateString("pt-BR", { timeZone: FUSO, weekday: "long", day: "2-digit", month: "2-digit" })}</b> — ${dias === 1 ? "falta 1 dia" : `faltam ${dias} dias`}.`
    : `A janela de anúncio da <b>${alvo.rotulo}</b> já abriu e o canal de ${time(ME).apelido} × ${time(adv).apelido} ainda não apareceu. Vale checar manualmente.`;
})();

/* ---------- canais -------------------------------------------------------- */
$("#canais").innerHTML = Object.entries(canais).map(([k, c]) => `
  <div class="canal">
    <div class="mk">${selo(k)}</div>
    <p>${c.onde}</p>
    ${c.assinado ? `<span class="tagv">você já assina</span>` : `<span class="tagn">não assinado</span>`}
  </div>`).join("");

$("#emissoras").innerHTML = Object.entries(emissoras).filter(([k]) => k[0] !== "_").map(([k, e]) => `
  <span class="eua grande ${e.fundo === "escuro" ? "escuro" : "claro"}" title="${e.nome}" style="--c:${e.cor}">
    <img src="${e.logo}" alt="${e.nome}" onerror="this.remove()"><i class="wm">${e.marca}</i>
  </span>`).join("");

/* Crédito de origem dos arquivos baixados — a licença de cada um está no catálogo. */
(function creditos() {
  const comLicenca = [...Object.values(emissoras), ...Object.values(pacotes), ...Object.values(conferencias)]
    .filter(x => x && x.licenca);
  if (!comLicenca.length) return;
  const licencas = [...new Set(comLicenca.map(x => x.licenca))].join(", ");
  $("#creditos").innerHTML = `Logos de emissoras, pacotes e conferências: ${comLicenca.length} arquivos do
    <a href="https://commons.wikimedia.org">Wikimedia Commons</a> (${licencas}). As marcas pertencem aos
    respectivos titulares e aparecem aqui apenas para identificar quem transmite cada jogo.`;
})();

/* ---------- o que mudou --------------------------------------------------- */
(function log() {
  const itens = (mudancas.entradas || []).flatMap(e =>
    e.mudancas.map(m => ({ quando: e.quando, ...m }))).slice(0, 12);
  $("#mudancas").innerHTML = itens.length
    ? itens.map(m => `<li>
        <span class="q">${new Date(m.quando).toLocaleDateString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit" })}</span>
        <span class="t">${m.tipo}</span>
        <span>${m.jogo}${m.placar ? ` — ${m.placar}` : ""}${m.de ? ` — de ${hora(m.de)} para ${hora(m.para)}` : ""}</span>
      </li>`).join("")
    : `<li><span>Nenhuma alteração registrada ainda.</span></li>`;
})();
