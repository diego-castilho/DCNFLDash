# Roadmap

## Pronto — v0.2.0

- **Dado separado da apresentação.** 154 KB de arquivo único viraram JSONs versionados,
  assets em disco e um painel que não guarda dado nenhum.
- **Ingestão determinística.** As 18 semanas e os playoffs vêm da API da ESPN. A tabela da
  temporada nunca mais é digitada à mão, e a regra "placar só em jogo encerrado" virou
  código em vez de instrução.
- **Fuso resolvido na origem.** Kickoff em UTC, conversão na exibição. A regra manual de
  horário de verão deixou de existir.
- **Regras fixas da grade brasileira.** TNF e SNF no SporTV, MNF na ESPN, Netflix nos jogos
  dela: 44 jogos preenchidos sem nenhuma busca.
- **Portão de validação.** Dez regras, cada uma correspondendo a uma falha real do v1.
- **Publicação automática** no GitHub Pages a cada push em `main`.
- **Painel novo**: próximo jogo com contagem regressiva, números da temporada, corrida da
  AFC, grade navegável por rodada, temporada do Pittsburgh, radar de transmissão e log de
  alterações.
- **Selo de frescor.** Verde, âmbar ou vermelho conforme a idade do último sync — falha
  silenciosa virou falha visível.

## Pronto — v0.3.0

- **Placares numa coluna só.** O cartão do jogo passou a ter largura previsível nas colunas
  das pontas, então o placar cai na mesma vertical em todos os jogos.
- **Emissora americana em cada jogo**, para assistir viajando. Marcas tipográficas nas cores
  de cada rede, com troca automática por imagem se o arquivo existir (ver DADOS.md).
- **TNF, SNF e MNF marcados** no cartão do jogo, no hero e nos cards da temporada — a mesma
  definição que decide o canal brasileiro.
- **Corrida da NFC** ao lado da AFC, com líderes de divisão e seeding.
- **Netflix e Game Pass com marca própria** (DAZN, no caso do Game Pass) em vez de texto.
- **Cards da temporada com logo** em vez do nome do canal escrito.

## Próximo — v0.4.0

**Tarefa agendada do Claude para a grade brasileira.** É o que falta para o ciclo fechar.
Terça e quinta de manhã, seguindo [OPERACAO.md](OPERACAO.md) e a regra de validação de
fonte de [FONTES.md](FONTES.md). Precisa ser criada presa ao Mac, porque depende do `gh`
autenticado para commitar.

**Pós-jogo do Steelers.** Box score resumido do último jogo — jardas, turnovers, líderes de
passe, corrida e recepção — a partir do endpoint `summary` da ESPN. É a melhoria que tira o
painel do "onde eu assisto" e o leva para o "como foi". Script novo (`sync-jogo.mjs`)
gravando só o jogo mais recente, para não inflar o repositório com 285 box scores.

## Depois

- **Pré-jogo**: linha, over/under e histórico do confronto. As odds já vêm na mesma resposta
  da API que o sync consome; é só passar a gravá-las.
- **Cenários de classificação** a partir da Semana 10: quais resultados da rodada colocam o
  Pittsburgh em cada seed.
- **Domínio próprio** (`nfl.diegocastilho.me`): um registro CNAME apontando para
  `diego-castilho.github.io`, um arquivo `CNAME` em `site/` e pronto. Está fora do v0.2.0
  só porque depende de mexer no DNS.
- **Histórico entre temporadas**: a estrutura já suporta — `temporada.json` tem o ano no
  nome do campo, não no do arquivo. Quando 2027 começar, vale decidir se arquiva 2026 ou se
  o painel ganha um seletor.

## Decidido que não vai ter

- **Feed `.ics` de calendário.** Foi avaliado e descartado a pedido.
- **Painel da liga inteira.** O escopo é Steelers-first, com a liga como contexto. Standings
  das outras divisões e jogos sem relação com a corrida da AFC ficam de fora de propósito —
  o valor do painel está no foco.
