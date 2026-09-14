# DCNFLDash

Painel da temporada 2026/27 da NFL com foco no Pittsburgh Steelers e, principalmente,
em responder uma pergunta que nenhum site responde direito no Brasil: **esse jogo passa
em qual canal aqui?**

## O problema que ele resolve

Placar e horário são fáceis — existe API para isso. O difícil é a grade brasileira:
a cada rodada, SporTV escolhe um jogo de domingo à tarde, a ESPN escolhe dois e a ge TV
escolhe um. Essa escolha sai durante a semana, é anunciada de forma dispersa, e não existe
nenhuma fonte estruturada. É a única parte do painel que depende de alguém procurar.

O projeto separa essas duas naturezas de informação e trata cada uma como ela merece:

| | Confrontos, horários, placares | Grade brasileira |
|---|---|---|
| Fonte | API de scoreboard da ESPN | busca manual, rodada a rodada |
| Quem atualiza | `scripts/sync-espn.mjs` no GitHub Actions | tarefa agendada do Claude |
| Frequência | 30 em 30 min nas janelas de jogo | terças e quintas |
| Pode errar? | não — é transcrição de JSON | sim — por isso tem regra de validação de fonte |

## Como usar

O painel publicado atualiza sozinho. Para mexer localmente:

```bash
npm run sync      # busca a temporada na ESPN e reescreve dados/temporada.json
npm run validar   # roda o portão de qualidade dos dados
npm run servir    # monta _site/ e sobe em http://localhost:8788
```

`npm run servir` é necessário porque o painel lê os JSONs via `fetch` — abrir o
`index.html` direto do disco não funciona.

## Organização

```
dados/          fonte única da verdade, versionada em JSON
  temporada.json    285 jogos: confronto, kickoff em UTC, estado, placar
  canais-br.json    qual canal brasileiro pegou cada jogo, com fonte e data da checagem
  canais.json       catálogo dos canais
  times.json        catálogo dos 32 times, com conferência e divisão
  mudancas.json     log do que o sync alterou — alimenta o bloco "o que mudou"
scripts/        tudo que escreve em dados/ passa por aqui
site/           apresentação pura: não contém nenhum dado
docs/           por que cada coisa é como é
legado/         o painel v1 de arquivo único, preservado como referência
```

## Documentação

- [ARQUITETURA.md](docs/ARQUITETURA.md) — as três camadas e por que elas são separadas
- [OPERACAO.md](docs/OPERACAO.md) — o que roda, quando, por quê, e o que fazer quando falha
- [FONTES.md](docs/FONTES.md) — fontes da grade brasileira e a regra que evita o erro mais provável
- [DADOS.md](docs/DADOS.md) — formato dos JSONs e por que cada regra de validação existe
- [GITFLOW.md](docs/GITFLOW.md) — convenção de branches e commits
- [ROADMAP.md](docs/ROADMAP.md) — o que já está pronto e o que vem depois

---

Criado por Diego Castilho.
