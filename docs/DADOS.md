# Dados

Tudo em `dados/` é fonte da verdade e versionado. Nada em `site/` guarda dado.

## `temporada.json`

Reescrito inteiro a cada sync. Nunca editar à mão — a próxima execução sobrescreve.

```json
{
  "temporada": 2026,
  "atualizadoEm": "2026-09-14T03:52:11.004Z",   // quando o conteúdo mudou pela última vez
  "verificadoEm": "2026-09-14",                 // dia em que o sync rodou e conferiu
  "fonte": "ESPN scoreboard API",
  "totalJogos": 285,
  "semanas": [
    {
      "fase": "regular",          // regular | playoffs
      "numero": 1,
      "rotulo": "Semana 1",
      "inicio": "2026-09-10T00:20Z",
      "fim": "2026-09-15T00:15Z",
      "jogos": [
        {
          "id": "401772936",
          "fase": "regular",
          "semana": 1,
          "rotulo": "Semana 1",
          "aDefinir": false,        // true nos playoffs sem classificados
          "visitante": "ATL",       // null quando aDefinir
          "mandante": "PIT",
          "kickoff": "2026-09-13T17:00Z",
          "horarioAConfirmar": false,
          "estado": "final",        // agendado | andamento | final | adiado
          "placar": { "visitante": 13, "mandante": 20 },
          "parcial": null,          // texto, só quando estado === "andamento"
          "local": { "estadio": "Acrisure Stadium", "cidade": "Pittsburgh", "uf": "PA", "pais": "USA" },
          "emissoraEua": "FOX",             // texto cru, como a ESPN devolve
          "emissoras": ["fox"],             // chaves de dados/emissoras-eua.json
          "pacote": null,                   // TNF | SNF | MNF | null
          "nota": ""
        }
      ]
    }
  ]
}
```

## `canais-br.json`

A única parte editada por pesquisa. Chave: `"<semana>:<visitante>@<mandante>"`.

```json
{
  "atualizadoEm": "2026-09-14",
  "jogos": {
    "4:PIT@CLE": {
      "fase": "regular", "semana": 4, "visitante": "PIT", "mandante": "CLE",
      "canais": ["sportv"],
      "fonte": "regra fixa · Thursday Night · pacote do SporTV",
      "url": "",
      "checadoEm": "2026-09-14",
      "confianca": "confirmado"     // confirmado | provavel
    }
  }
}
```

`fonte`, `url` e `checadoEm` não são burocracia: são o que permite a execução seguinte
saber *de onde veio* e *quando foi checado*, e o que permite auditar um canal errado sem
adivinhar quem o escreveu.

## `emissoras-eua.json`

Catálogo das emissoras americanas, para quando o Diego assiste de fora do Brasil. Cada
entrada tem `nome`, `marca` (a marca tipográfica desenhada pelo painel), `cor` e `logo`.

O campo `logo` aponta para `site/assets/emissoras/<chave>.webp`, um arquivo que **pode não
existir** — e normalmente não existe. Nesse caso o `onerror` da imagem some com ela e a
marca tipográfica aparece no lugar. Para passar a usar o logo oficial de qualquer emissora,
basta salvar o arquivo nesse caminho; nenhuma linha de código muda.

## Pacotes de prime time

`pacote` é calculado no sync por `pacoteDe()` em `scripts/lib/comum.mjs` e vale TNF, SNF,
MNF ou nada. Uma definição só, usada em dois lugares: a marca que aparece no cartão do jogo
e a regra fixa que decide o canal brasileiro. Antes eram duas implementações da mesma ideia
em arquivos diferentes — que é como elas começam a divergir.

A regra do TNF exige **quinta-feira e Prime Video**, não só Prime Video: o jogo de Black
Friday também é do Prime nos EUA e não tem detentor definido no Brasil.

## Por que cada regra de validação existe

Nenhuma delas é hipotética. Todas correspondem a uma falha real, observada no painel v1 ou
no primeiro sync.

| Regra | O que aconteceu |
|---|---|
| placar exige `estado === "final"` | o v1 tinha Cowboys 14 x 21 Giants congelado no 4º quarto; o placar real foi 20 x 28. Um número errado que parecia certo. |
| `placar` e `parcial` não coexistem | o mesmo jogo tinha os dois campos, e o painel mostrava "4º quarto · ao vivo" num jogo encerrado há horas |
| jogo `final` tem que ter placar | estado e placar são a mesma informação; discordarem significa dado pela metade |
| sigla precisa existir em `times.json` | o primeiro sync trouxe `TBD` nos playoffs e teria criado 26 times fantasma |
| `aDefinir` só com `estado: "agendado"` | um jogo sem times não pode estar em andamento |
| canal precisa existir em `canais.json` | um typo em `"sportv"` some do painel silenciosamente |
| jogo da grade br tem que existir na temporada | pega entrada de temporada anterior e confronto que mudou por flex |
| `confirmado` exige `fonte` | canal sem procedência não é confirmação, é lembrança |
| `totalJogos` bate com os jogos presentes | resposta parcial da API não pode passar por temporada completa |
| `verificadoEm` obrigatório, aviso se > 2 dias | o painel v1 podia ficar dias parado sem nenhum sinal |
| emissora americana precisa existir no catálogo | um nome novo da ESPN ("NFL+", "Peacock") passaria despercebido e sumiria do painel |
| `pacote` só pode ser TNF, SNF ou MNF | valor solto aqui vira canal brasileiro errado, porque a regra fixa lê este campo |

### Por que dois carimbos de tempo

`atualizadoEm` responde "o dado mudou quando?" e `verificadoEm` responde "o sync rodou
quando?". São perguntas diferentes: numa terça sem jogo nada muda, e isso é o esperado — o
que seria alarmante é o sync ter parado de rodar. O selo do painel usa `verificadoEm`.

A separação tem um efeito prático: como `atualizadoEm` só se mexe quando o conteúdo muda, o
sync de 30 em 30 minutos não gera commit só porque o relógio andou. Commita quando algo
muda de verdade — ou uma vez por dia, quando `verificadoEm` vira.

## Classificação: o que é calculado e onde é aproximado

Campanha, divisão e seeding saem de `temporada.json`, considerando só jogos com
`estado: "final"` e `fase: "regular"`.

Desempate aplicado, nesta ordem: **aproveitamento → confronto direto → campanha na divisão
→ saldo de pontos.**

A NFL usa uma escada bem mais longa (jogos em comum, campanha na conferência, ranking de
pontos marcados e sofridos, e mais critérios até o sorteio). Para acompanhar a corrida a
aproximação acima acerta na esmagadora maioria dos casos, mas **pode divergir do seeding
oficial em empates finos, especialmente no fim da temporada.** Quando a diferença importar
de verdade, a fonte é a classificação oficial da NFL.

## Escudos e logos

Extraídos do painel v1 (`scripts/extrair-legado.mjs`) para `site/assets/`, como arquivos
`.webp` de verdade em vez de base64. São 32 escudos e 3 logos de canal, ~148 KB no total,
carregados sob demanda com `loading="lazy"`.
