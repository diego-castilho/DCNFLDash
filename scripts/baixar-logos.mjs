/**
 * Baixa logos do Wikimedia Commons para site/assets/.
 *
 * POR QUE Commons e não "a primeira imagem que aparecer": o Commons publica a licença
 * de cada arquivo de forma legível por máquina. O script só aceita domínio público ou
 * licença livre, e grava licença e URL de origem no catálogo correspondente — quem
 * abrir o repositório sabe de onde veio cada arquivo e sob que termos.
 *
 * POR QUE arquivo e não base64 embutido: o navegador cacheia o arquivo entre visitas,
 * os JSONs continuam legíveis, o diff do git continua pequeno e trocar um logo é
 * substituir um arquivo — foi o base64 dentro do HTML que fez o painel v1 pesar 154 KB.
 *
 * Se nada passar no filtro de licença, o logo não é baixado e o painel desenha a marca
 * tipográfica. Ausência de logo não é erro.
 *
 * Uso:  node scripts/baixar-logos.mjs [--listar "termo de busca"]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { RAIZ, lerJson, gravarJson, buscarJson } from "./lib/comum.mjs";

const API = "https://commons.wikimedia.org/w/api.php";

/* Cada arquivo foi escolhido a dedo e conferido um a um no Commons. */
const ALVOS = [
  // emissoras dos EUA
  { catalogo: "dados/emissoras-eua.json", chave: "cbs",     pasta: "assets/emissoras", titulo: "File:CBS 2018.svg" },
  { catalogo: "dados/emissoras-eua.json", chave: "fox",     pasta: "assets/emissoras", titulo: "File:Fox Broadcasting Company logo (2019).svg" },
  { catalogo: "dados/emissoras-eua.json", chave: "nbc",     pasta: "assets/emissoras", titulo: "File:NBC logo 2022.svg" },
  { catalogo: "dados/emissoras-eua.json", chave: "abc",     pasta: "assets/emissoras", titulo: "File:ABC-2021-LOGO.svg" },
  { catalogo: "dados/emissoras-eua.json", chave: "espn",    pasta: "assets/emissoras", titulo: "File:ESPN wordmark.svg" },
  { catalogo: "dados/emissoras-eua.json", chave: "prime",   pasta: "assets/emissoras", titulo: "File:Prime Video logo (2024).svg" },
  { catalogo: "dados/emissoras-eua.json", chave: "netflix", pasta: "assets/emissoras", titulo: "File:Netflix logo.svg" },
  { catalogo: "dados/emissoras-eua.json", chave: "peacock", pasta: "assets/emissoras", titulo: "File:NBCUniversal Peacock Logo (2026).svg" },
  // pacotes de prime time (o TNF não tem logo livre no Commons — fica a marca desenhada)
  { catalogo: "dados/pacotes.json",       chave: "SNF",     pasta: "assets/pacotes",   titulo: "File:NBC Sunday Night Football logo 2022.svg" },
  { catalogo: "dados/pacotes.json",       chave: "MNF",     pasta: "assets/pacotes",   titulo: "File:ESPN Monday Night Football logo.png" },
  // conferências
  { catalogo: "dados/conferencias.json",  chave: "AFC",     pasta: "assets/ligas",     titulo: "File:American Football Conference logo.svg" },
  { catalogo: "dados/conferencias.json",  chave: "NFC",     pasta: "assets/ligas",     titulo: "File:National Football Conference logo.svg" }
];

const LICENCA_OK = /public domain|pd-|cc0|cc by|cc-by|creative commons/i;
const LICENCA_NAO = /fair use|non-free/i;

// O Commons responde 429 com rajadas curtas; este intervalo mantém o script dentro do limite.
const respirar = () => new Promise(r => setTimeout(r, 2500));
const extensaoDe = u => { try { return new URL(u).pathname.split(".").pop().toLowerCase(); } catch { return ""; } };

function normalizar(pages) {
  return Object.values(pages || {}).map(p => {
    const info = p.imageinfo?.[0] || {};
    const meta = info.extmetadata || {};
    return {
      titulo: p.title,
      url: info.url,
      descricao: info.descriptionurl,
      licenca: (meta.LicenseShortName?.value || meta.UsageTerms?.value || "desconhecida").replace(/<[^>]+>/g, "")
    };
  });
}

async function consultar(params) {
  await respirar();
  return buscarJson(`${API}?action=query&format=json&prop=imageinfo&iiprop=url|size|extmetadata&${params}`);
}

const aceitavel = c => c.url && ["svg", "png", "webp"].includes(extensaoDe(c.url))
  && LICENCA_OK.test(c.licenca) && !LICENCA_NAO.test(c.licenca);

/* --- modo busca: ajuda a escolher o título antes de fixá-lo na lista acima --- */
const iBusca = process.argv.indexOf("--listar");
if (iBusca > -1) {
  const termo = process.argv[iBusca + 1];
  const r = await consultar(`generator=search&gsrsearch=${encodeURIComponent(termo)}&gsrnamespace=6&gsrlimit=8`);
  for (const c of normalizar(r.query?.pages)) console.log(`${aceitavel(c) ? "OK " : "não"}  ${c.titulo}  [${c.licenca}]`);
  process.exit(0);
}

/* --- download --- */
const catalogos = {};
const ler = c => (catalogos[c] ||= lerJson(c, {}));

for (const alvo of ALVOS) {
  const r = await consultar(`titles=${encodeURIComponent(alvo.titulo)}`);
  const escolhido = normalizar(r.query?.pages).find(aceitavel);
  if (!escolhido) { console.log(`${alvo.chave}: "${alvo.titulo}" não passou no filtro de licença — mantém a marca tipográfica`); continue; }

  const ext = extensaoDe(escolhido.url);
  const destino = `${alvo.pasta}/${alvo.chave.toLowerCase()}.${ext}`;
  mkdirSync(`${RAIZ}/site/${alvo.pasta}`, { recursive: true });
  const bin = Buffer.from(await (await fetch(escolhido.url, {
    headers: { "User-Agent": "DCNFLDash/1.0 (+github.com/diego-castilho/DCNFLDash)" }
  })).arrayBuffer());
  writeFileSync(`${RAIZ}/site/${destino}`, bin);

  const cat = ler(alvo.catalogo);
  cat[alvo.chave] = { ...cat[alvo.chave], logo: destino, licenca: escolhido.licenca, origem: escolhido.descricao };
  // Grava a cada download, e não só no fim: o Commons às vezes responde 429 no meio
  // da lista, e perder tudo que já tinha vindo por causa disso seria bobagem.
  gravarJson(alvo.catalogo, cat);
  console.log(`${alvo.chave.padEnd(8)} ${escolhido.titulo}  [${escolhido.licenca}]  → ${destino} (${(bin.length / 1024).toFixed(1)} KB)`);
}

console.log("\ncatálogos atualizados com caminho, licença e origem de cada arquivo");
