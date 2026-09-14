# Arquitetura

## A decisão que organiza tudo

O painel v1 era um arquivo HTML de 154 KB com os dados embutidos num bloco `const` e a
instrução "mexa só aqui". Funcionava enquanto o Diego editava à mão. Não funcionava como
base para automação, por três motivos que se reforçam:

1. **Dado e apresentação no mesmo arquivo.** Qualquer atualização obrigava a abrir 154 KB
   — dos quais ~95% eram escudos em base64 — para mudar dois números.
2. **A mesma verdade em vários lugares.** O placar do jogo do Pittsburgh vivia em `SEMANAS`
   (campo `placar`) e em `STEELERS` (campo `res`); o horário vivia em `data`+`h` e também em
   `dt`+`iso`. Nada garantia que os quatro concordassem.
3. **Nenhuma distinção entre o que é fato e o que é pesquisa.** Placar e canal brasileiro
   eram tratados como o mesmo tipo de informação, embora um venha de API e o outro dependa
   de alguém achar um anúncio.

O projeto resolve os três separando em camadas.

## As três camadas

```
   ┌─────────────────────────────────────────────────────────┐
   │ 1. INGESTÃO DETERMINÍSTICA        scripts/sync-espn.mjs  │
   │    API da ESPN → dados/temporada.json                    │
   │    Sem julgamento. Sem modelo de linguagem. Sem palpite. │
   └─────────────────────────────────────────────────────────┘
                              ↓
   ┌─────────────────────────────────────────────────────────┐
   │ 2. CAMADA BRASILEIRA                                    │
   │    a) regras fixas da temporada  aplicar-regras-br.mjs  │
   │       TNF e SNF → SporTV · MNF → ESPN · Netflix → Netflix│
   │    b) escolha semanal            tarefa agendada Claude  │
   │       domingo à tarde: busca, valida a fonte, grava      │
   │    → dados/canais-br.json                                │
   └─────────────────────────────────────────────────────────┘
                              ↓
   ┌─────────────────────────────────────────────────────────┐
   │ 3. VALIDAÇÃO                      scripts/validar.mjs    │
   │    Portão obrigatório. Roda no CI e antes de todo commit.│
   └─────────────────────────────────────────────────────────┘
                              ↓
   ┌─────────────────────────────────────────────────────────┐
   │ 4. APRESENTAÇÃO                   site/                  │
   │    Lê os JSONs e não guarda nenhum dado próprio.         │
   │    Campanha, classificação e radar são calculados aqui.  │
   └─────────────────────────────────────────────────────────┘
```

## Por que nada derivado é gravado em arquivo

Campanha do time, classificação da AFC, contagem por canal — tudo isso é calculado no
navegador a partir de `dados/temporada.json`. Gravar esses números em arquivo criaria
exatamente o problema que motivou a reescrita: dois lugares dizendo a mesma coisa, com
chance de discordarem. O custo de recalcular 285 jogos no navegador é irrelevante; o custo
de um painel que se contradiz não é.

## Por que GitHub e não a máquina local

O painel v1 dependia do Mac ligado. Uma tarefa agendada para 04:00 numa máquina que dorme
às 23:00 simplesmente não roda — e não avisa. No GitHub Actions, o sync roda
independentemente de qualquer máquina do Diego estar ligada, o histórico de cada alteração
fica em commit, e a falha aparece como workflow vermelho em vez de silêncio.

A única parte que ainda pode depender do Mac é a tarefa do Claude que preenche a grade
brasileira, porque ela precisa de credencial para commitar. A consequência dessa escolha é
deliberada: **se o Mac estiver desligado, o painel continua com placares corretos** e só a
grade de canais atrasa. Falha parcial, nunca total.

## Fusos

`temporada.json` guarda kickoff em UTC, exatamente como a ESPN devolve. A conversão para
Brasília acontece na hora de exibir, com `Intl.DateTimeFormat` e `timeZone: America/Sao_Paulo`.

Isso elimina uma classe inteira de erro. O painel v1 trazia a instrução manual "até 1º de
novembro a conversão é +1 hora; a partir daí, +2" — uma regra que dependia de quem editava
lembrar da data em que o horário de verão americano termina. Com UTC na origem e conversão
na exibição, a regra deixa de existir.
