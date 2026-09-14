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

const [temporada, times, canais, gradeBr, mudancas] = await Promise.all([
  fetch("dados/temporada.json").then(r => r.json()),
  fetch("dados/times.json").then(r => r.json()),
  fetch("dados/canais.json").then(r => r.json()),
  fetch("dados/canais-br.json").then(r => r.json()),
  fetch("dados/mudancas.json").then(r => r.json()).catch(() => ({ entradas: [] }))
]);

const JOGOS = temporada.semanas.flatMap(s => s.jogos);
const ME = "PIT";

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

/* ---------- grade brasileira ------------------------------------------- */
const chaveJogo = j => `${j.fase || "regular"}:${j.semana}:${j.visitante}@${j.mandante}`;
const mapaBr = new Map();
for (const g of Object.values(gradeBr.jogos || {})) {
  mapaBr.set(`${g.fase || "regular"}:${g.semana}:${g.visitante}@${g.mandante}`, g);
}
const brDe = j => mapaBr.get(chaveJogo(j)) || null;
const temTvBr = j => !!brDe(j)?.canais?.length;

function selo(chave) {
  const c = canais[chave];
  if (!c) return "";
  if (c.logo) return `<span class="ch" title="${c.nome}"><img src="${c.logo}" alt="${c.nome}"></span>`;
  return `<span class="ch texto" style="background:${c.cor};color:${c.corTexto}">${c.nome}</span>`;
}

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
    const mesmaDiv = times[j.visitante].divisao === times[j.mandante].divisao
      && times[j.visitante].conferencia === times[j.mandante].conferencia;
    const mesmaConf = times[j.visitante].conferencia === times[j.mandante].conferencia;
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
  return [...campeoes, ...resto.slice(0, 3)].concat(resto.slice(3));
}

const SEEDS_AFC = seedsDaConferencia("AFC");
const MEU_SEED = SEEDS_AFC.findIndex(x => x.sigla === ME) + 1;

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
  if (br) return { classe: "ok", texto: br.canais.map(c => canais[c]?.nome || c).join(" · ") };
  const passou = Date.now() > Date.parse(j.kickoff) + DURACAO;
  if (passou) return { classe: "fora", texto: "ficou fora da TV brasileira" };
  if (j.local.pais !== "USA" || /NFL Net/i.test(j.emissoraEua)) return { classe: "duvida", texto: "sem detentor definido no Brasil" };
  return { classe: "risco", texto: "depende da escolha da rodada" };
}

/* ---------- hero --------------------------------------------------------- */
(function hero() {
  const alvo = MEUS.find(j => Date.parse(j.kickoff) + DURACAO > Date.now()) || MEUS[MEUS.length - 1];
  if (!alvo) return;
  $("#hero").hidden = false;

  const casa = alvo.mandante === ME;
  const adv = casa ? alvo.visitante : alvo.mandante;
  const bloco = s => `<div class="hero-time">${escudo(s)}<div><div class="nm">${time(s).apelido}</div><div class="sg">${s}</div></div></div>`;
  $("#heroMat").innerHTML = casa
    ? bloco(ME) + `<span class="hero-vs">recebe</span>` + bloco(adv)
    : bloco(ME) + `<span class="hero-vs">visita</span>` + bloco(adv);

  $("#heroRotulo").textContent = `${alvo.rotulo} · ${casa ? "em Pittsburgh" : "fora de casa"}`;
  $("#heroQuando").textContent = alvo.horarioAConfirmar
    ? `${alvo.nota || "data ainda não fechada"}`
    : `${cap(dataLonga(alvo.kickoff))} · ${hora(alvo.kickoff)} (Brasília)`;
  $("#heroLocal").textContent = [alvo.local.estadio, alvo.local.cidade].filter(Boolean).join(" · ");

  const s = situacao(alvo);
  const br = brDe(alvo);
  $("#heroOnde").innerHTML = br
    ? br.canais.map(selo).join(" ") + ` <span style="color:var(--texto3);font-size:12px">${br.fonte ? "· " + br.fonte : ""}</span>`
    : `<span style="color:var(--texto2)">${s.texto}</span>`;

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

/* ---------- corrida da AFC ----------------------------------------------- */
(function afc() {
  const norte = Object.values(TAB)
    .filter(x => times[x.sigla].conferencia === "AFC" && times[x.sigla].divisao === "Norte")
    .sort(ordenar);

  $("#tabDivisao").innerHTML = `
    <tr><th>Time</th><th>V-D</th><th>Div</th><th>Saldo</th></tr>
    ${norte.map(x => `
      <tr class="${x.sigla === ME ? "pit" : ""}">
        <td>${escudo(x.sigla)} ${time(x.sigla).apelido}</td>
        <td>${x.cartaz}</td>
        <td>${x.divV}-${x.divD}</td>
        <td>${x.saldo > 0 ? "+" : ""}${x.saldo}</td>
      </tr>`).join("")}`;

  $("#seeds").innerHTML = SEEDS_AFC.slice(0, 10).map((x, i) => `
    <li class="${x.sigla === ME ? "pit" : ""} ${i === 7 ? "corte" : ""}">
      ${escudo(x.sigla)} ${time(x.sigla).apelido}
      <span class="rec">${x.cartaz}</span>
    </li>`).join("");

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

function linhaTime(sigla, pts, venceu, perdeu, mostrarPts) {
  return `<div class="time ${venceu ? "venceu" : ""} ${perdeu ? "perdeu" : ""}">
    ${sigla ? escudo(sigla) : `<span style="width:24px"></span>`}
    <span class="nm">${sigla ? time(sigla).apelido : "a definir"}</span>
    ${mostrarPts ? `<span class="pt">${pts}</span>` : ""}
  </div>`;
}

function cartaoJogo(j) {
  const estado = estadoVisual(j);
  const fim = estado === "final";
  const br = brDe(j);
  const semTv = !br;
  const vV = fim && j.placar.visitante > j.placar.mandante;
  const vM = fim && j.placar.mandante > j.placar.visitante;
  const ehMeu = j.visitante === ME || j.mandante === ME;

  const estadoTxt =
    estado === "andamento" ? `<span class="e vivo"><span class="pulso"></span> ${j.parcial || "ao vivo"}</span>`
    : fim ? `<span class="e fim">encerrado</span>`
    : estado === "adiado" ? `<span class="e">adiado</span>`
    : j.horarioAConfirmar ? `<span class="e">a confirmar</span>`
    : `<span class="e">Brasília</span>`;

  const passou = Date.now() > Date.parse(j.kickoff) + DURACAO;
  const selos = br ? br.canais.map(selo).join("")
    : `<span class="ch tbd">${passou ? "sem TV brasileira" : "a definir"}</span>`;
  const gamepass = !br || !br.canais.includes("gamepass") ? selo("gamepass") : "";

  return `<div class="jogo ${ehMeu ? "pit" : ""} ${semTv ? "semtv" : ""} ${estado === "andamento" ? "vivo" : ""}" data-br="${semTv ? 0 : 1}">
    <div class="quando"><span class="h">${j.horarioAConfirmar ? "--:--" : hora(j.kickoff)}</span>${estadoTxt}</div>
    <div>
      ${linhaTime(j.visitante, fim ? j.placar.visitante : "", vV, fim && !vV, fim)}
      ${linhaTime(j.mandante, fim ? j.placar.mandante : "", vM, fim && !vM, fim)}
      ${j.nota ? `<div class="etq">${j.nota}</div>` : ""}
      ${j.local.pais !== "USA" ? `<div class="etq">${j.local.cidade}, fora dos EUA</div>` : ""}
    </div>
    <div class="chs">${selos}${gamepass}</div>
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

  $("#grade").innerHTML = nota + Object.entries(porDia).map(([d, jogos]) => `
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
    cartoes.push(`
      <div class="sem ${s.classe}">
        <div class="n">Semana ${n} · ${casa ? "em casa" : "fora"}</div>
        <div class="adv">${escudo(adv)} ${time(adv).apelido}</div>
        <div class="dt">${j.horarioAConfirmar ? "data a definir" : `${dia(j.kickoff).split("-").reverse().slice(0, 2).join("/")} · ${hora(j.kickoff)}`}</div>
        ${fim ? `<div class="res ${meu > dele ? "v" : "d"}">${meu > dele ? "Vitória" : "Derrota"} ${meu} x ${dele}</div>` : ""}
        <div class="tv">${s.texto}</div>
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
        <div class="top">${c.logo ? `<img src="${c.logo}" alt="${c.nome}">` : `<span class="nome">${c.nome}</span>`}</div>
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
$("#canais").innerHTML = Object.values(canais).map(c => `
  <div class="canal">
    <div class="mk">${c.logo ? `<img src="${c.logo}" alt="${c.nome}">` : `<strong>${c.nome}</strong>`}</div>
    <p>${c.onde}</p>
    ${c.assinado ? `<span class="tagv">você já assina</span>` : `<span class="tagn">não assinado</span>`}
  </div>`).join("");

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
