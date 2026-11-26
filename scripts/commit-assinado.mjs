// Grava as mudanças de uma pasta como um commit assinado pelo GitHub.
//
// POR QUÊ: `git commit` + `git push` com o GITHUB_TOKEN gera commit sem assinatura,
// e uma regra que exija assinatura em `main` recusaria o push do bot. Commit criado
// pela API (`createCommitOnBranch`) sai assinado pelo próprio GitHub e aparece como
// Verified, sem chave nenhuma guardada no repositório.
//
// USO: node scripts/commit-assinado.mjs <branch> <pasta> <mensagem>
// AMBIENTE: GITHUB_TOKEN e GITHUB_REPOSITORY (o segundo o Actions já fornece).
//
// Se a branch andou desde o checkout, a API recusa (expectedHeadOid) e o job falha,
// como falharia o `git push` antes. Não há tentativa de reaplicar por cima.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const [branch, pasta, mensagem] = process.argv.slice(2);
const { GITHUB_TOKEN, GITHUB_REPOSITORY } = process.env;
const api = process.env.GITHUB_API_URL ?? "https://api.github.com";

if (!branch || !pasta || !mensagem || !GITHUB_TOKEN || !GITHUB_REPOSITORY) {
  console.error("uso: commit-assinado.mjs <branch> <pasta> <mensagem> (com GITHUB_TOKEN e GITHUB_REPOSITORY)");
  process.exit(2);
}

const git = (...a) => execFileSync("git", a, { encoding: "utf8" });

// -z: nomes com espaço ou acento chegam intactos. --untracked-files=all: arquivo
// novo dentro de pasta nova aparece por inteiro, não só a pasta.
const itens = git("status", "--porcelain", "-z", "--untracked-files=all", "--", pasta)
  .split("\0")
  .filter(Boolean);

const additions = [];
const deletions = [];
const conteudo = (caminho) => readFileSync(caminho).toString("base64");
for (let i = 0; i < itens.length; i++) {
  const estado = itens[i].slice(0, 2);
  const caminho = itens[i].slice(3);
  if (estado.includes("R")) {
    // Renomeado: no -z o nome antigo vem no item seguinte.
    deletions.push({ path: itens[++i] });
    additions.push({ path: caminho, contents: conteudo(caminho) });
  } else if (estado.includes("D")) {
    deletions.push({ path: caminho });
  } else {
    additions.push({ path: caminho, contents: conteudo(caminho) });
  }
}

if (additions.length + deletions.length === 0) {
  console.log("nada para gravar");
  process.exit(0);
}

const [titulo, ...resto] = mensagem.split("\n");
const corpoDaMensagem = resto.join("\n").trim();
const query = `mutation($input: CreateCommitOnBranchInput!) {
  createCommitOnBranch(input: $input) { commit { oid url } }
}`;
const variables = {
  input: {
    branch: { repositoryNameWithOwner: GITHUB_REPOSITORY, branchName: branch },
    expectedHeadOid: git("rev-parse", "HEAD").trim(),
    message: corpoDaMensagem ? { headline: titulo, body: corpoDaMensagem } : { headline: titulo },
    fileChanges: { additions, deletions },
  },
};

const resposta = await fetch(`${api}/graphql`, {
  method: "POST",
  headers: { Authorization: `bearer ${GITHUB_TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query, variables }),
});
const corpo = await resposta.json();
if (!resposta.ok || corpo.errors) {
  console.error("a API recusou o commit:", JSON.stringify(corpo.errors ?? corpo));
  process.exit(1);
}
const { oid, url } = corpo.data.createCommitOnBranch.commit;
console.log(`commit ${oid.slice(0, 7)}: ${additions.length} gravado(s), ${deletions.length} removido(s) — ${url}`);
