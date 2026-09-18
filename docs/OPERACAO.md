# Operação

O que roda, quando, por quê, e o que fazer quando falha.

## Rotinas automáticas

### 1. Sync da ESPN — `.github/workflows/sync.yml`

**Por quê:** placar, horário e confronto são fato publicado; ninguém deveria transcrever
isso à mão.

**Quando:** de 30 em 30 minutos, sempre (`*/30 * * * *`), mais uma varredura completa
diária às 11h UTC (8h de Brasília).

O desenho anterior tinha uma janela por tipo de jogo e deixava de fora 27 jogos da
temporada — as quintas de Thursday Night e Thanksgiving, as sextas de Black Friday e Natal,
os sábados e as quartas de abertura. Calendário mantido à mão erra de novo no primeiro jogo
em dia estranho.

**Dois modos:** no incremental (padrão) o script busca só as semanas com jogo numa janela
de −2 a +8 dias — uma ou duas requisições por execução. Na varredura completa busca as 23
semanas, e é ela que pega flex, horário anunciado e confronto de playoff definido.

Cron do GitHub é melhor esforço, não relógio: o agendamento das 8h já rodou às 12h13.
Rodando de 30 em 30 minutos isso deixa de importar.

**Publicação:** o próprio workflow chama o de publicação quando há mudança. Isso é
obrigatório, não conveniência: **push feito com o `GITHUB_TOKEN` de uma Action não dispara
outros workflows** — é regra do GitHub, para evitar recursão infinita. Sem a chamada
explícita o sync commita dados novos e o painel no ar continua parado, sem nenhum erro em
lugar nenhum para avisar. Foi exatamente o que aconteceu entre 14 e 15 de setembro de 2026.

Para republicar sem mexer em dados: `gh workflow run "Sync ESPN" -f publicar=true`.

**Segunda armadilha, encontrada logo depois da primeira:** o workflow de publicação faz
checkout de `main` explicitamente, e não do SHA do evento. Chamado pelo sync, o SHA do run
é o de *antes* do commit de dados — sem o `ref: main` o deploy publica exatamente a versão
que o sync acabou de substituir. O painel fica um ciclo inteiro atrás, para sempre, com tudo
verde no Actions. O passo "Conferir o que vai ao ar" imprime no log o `verificadoEm` e o
commit publicados, justamente para essa divergência nunca mais ser invisível.

**Como:** busca as 18 semanas e as 5 fases de playoff, reescreve `dados/temporada.json`,
registra o que mudou em `dados/mudancas.json`, roda o validador e só então commita. Se o
validador reprovar, **nada é commitado** — o painel fica um ciclo desatualizado em vez de
ficar errado.

**Salvaguarda:** o script aborta se vier menos de 200 jogos. Uma resposta parcial da API
não pode apagar uma temporada boa.

### 2. Grade brasileira — `scripts/sync-grade-br.mjs`

**Por quê:** descobrir em que canal cada jogo passa no Brasil era a única parte que
dependia de alguém procurar. Não depende mais: a agenda do ge publica isso em JSON
estruturado (ver [FONTES.md](FONTES.md)).

**Quando:** em toda execução do sync, junto com os placares.

**Como:** lê a agenda, confere cada confronto contra `temporada.json`, grava em
`canais-br.json` com fonte e data da checagem, e registra a descoberta em
`mudancas.json` — que é o que faz "Steelers × Patriots → SporTV" aparecer no bloco
"O que mudou" do painel.

### 3. Regras fixas da grade brasileira — `scripts/aplicar-regras-br.mjs`

**Por quê:** 44 jogos da temporada têm canal definido por contrato e não precisam de busca.

**Quando:** manualmente, ou junto da tarefa da grade brasileira. É idempotente e nunca
sobrescreve uma entrada de origem manual.

### 4. Publicação — `.github/workflows/pages.yml`

Roda a cada push em `main`, inclusive nos commits do próprio sync. Monta `_site/` com
`scripts/montar.mjs` — o mesmo script do ambiente local, para que os dois não divirjam.

## Rotina com julgamento: a grade brasileira

É a única parte que um script não resolve. Duas execuções por semana, **terça e quinta de
manhã**, que é quando os canais anunciam.

O que a execução precisa fazer:

1. Ler `dados/temporada.json` e listar os jogos da rodada corrente sem entrada em
   `dados/canais-br.json`.
2. Para cada um, procurar o anúncio seguindo a ordem de fontes de [FONTES.md](FONTES.md).
3. **Validar a data do anúncio** antes de acreditar nele — a regra está em FONTES.md e
   existe por causa de um erro real, não por hipótese.
4. Gravar a entrada com `fonte`, `url`, `checadoEm` e `confianca`.
5. Rodar `node scripts/validar.mjs` e commitar.
6. Escrever um resumo curto: canais confirmados, o que continua pendente, o que mudou de
   grade. Se nada mudou, uma linha dizendo isso.

O campo `checadoEm` existe para que a execução seguinte saiba a diferença entre *"ainda não
procurei"* e *"procurei e não havia anúncio"*. Sem ele, toda execução repete as mesmas buscas
infrutíferas e nunca aprende nada.

**Nunca sobrescrever uma entrada `confirmado` por uma dedução.** Se a informação nova
contradiz uma confirmação anterior, o certo é registrar a divergência no resumo e deixar o
humano decidir.

## Quando algo falha

| Sintoma | Provável causa | O que fazer |
|---|---|---|
| Selo do painel em vermelho ("sem sincronizar há N dias") | workflow de sync falhando | `gh run list --workflow="Sync ESPN"` e ver o log |
| Sync falha na validação | a ESPN mudou algum campo, ou dado inconsistente | rodar `node scripts/sync-espn.mjs` local e ler o erro do validador |
| Sync falha na busca | API fora do ar ou bloqueando | o script já tenta 3 vezes; se persistir, esperar o próximo ciclo |
| Jogo com placar errado | placar gravado antes do fim | conferir `estado`; o validador deveria ter pego — se não pegou, falta uma regra |
| Canal errado no painel | a agenda do ge mudou de formato, ou o jogo foi remanejado | rodar `node scripts/sync-grade-br.mjs` e ler a saída; entrada manual sempre vence a automática |
| Nenhum canal sendo descoberto | a agenda do ge mudou a estrutura do JSON | o script avisa "nenhum jogo da NFL na janela"; conferir `liveWatchSources` na página |
| Painel publicado sem atualizar, mas `dados/` em main está em dia | o sync commitou e a publicação não rodou | `gh workflow run "Sync ESPN" -f publicar=true` republica na hora; ver a nota abaixo sobre o GITHUB_TOKEN |
| Painel publicado sem atualizar | workflow do Pages | `gh run list --workflow="Publicar painel"` |

Ordem de investigação, sempre: **primeiro o JSON, depois o script, por último o painel.**
O `site/` não guarda dado nenhum; se um número está errado lá, ele veio errado de `dados/`.

## Comandos do dia a dia

```bash
npm run sync                       # atualiza a temporada a partir da ESPN
node scripts/aplicar-regras-br.mjs # preenche TNF/SNF/MNF/Netflix
npm run validar                    # portão de qualidade
npm run servir                     # painel local em http://localhost:8788

gh run list --limit 5              # últimas execuções
gh run watch                       # acompanhar a execução atual
```
