# Fontes

## Placares, horários e confrontos

**ESPN scoreboard API** — `site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`

```
?dates=2026&seasontype=2&week=N     temporada regular, semanas 1 a 18
?dates=2026&seasontype=3&week=N     playoffs (1 Wild Card … 5 Super Bowl)
?dates=AAAAMMDD                     todos os jogos de um dia
```

Pública, sem chave, sem limite documentado. Devolve confronto, kickoff em UTC, estádio,
emissora nos EUA, odds, status e placar. É a única fonte usada para esses campos, e o
script nunca "interpreta" nada: copia o que veio.

Campos que importam e não são óbvios:

- `competitions[0].status.type.completed` — **o único critério para gravar placar.**
  Não confie em `shortDetail` nem em o horário já ter passado.
- `competitions[0].timeValid` — `false` nos jogos de fim de temporada que ainda podem ser
  remanejados. Quando é `false`, a ESPN devolve um horário de fachada e a nota explica
  ("Flex Game: 1/9 or 1/10"). O painel mostra "data a definir", nunca o horário falso.
- `competitions[0].notes[0].headline` — jogos internacionais, Black Friday, flex.
- `competitors[].team.abbreviation` — vem `"TBD"` nos dois lados nos jogos de playoff
  antes de haver classificados. Vira `aDefinir: true`.
- Washington aparece como `WSH`; o painel usa `WAS`. O alias está em `scripts/lib/comum.mjs`.
- `competitions[0].broadcasts[0].names` — a emissora nos EUA. Vira chave do catálogo em
  `dados/emissoras-eua.json` e também alimenta a detecção de TNF/SNF/MNF.

## Grade brasileira

**Agenda do ge** — `https://ge.globo.com/agenda/`

A página traz, embutido no HTML, o JSON que alimenta a agenda esportiva. Para cada jogo
da NFL ele tem os dois times (com a sigla no nome do arquivo do escudo), a rodada, data e
hora de Brasília, e — o que importa — `liveWatchSources`: a lista de onde assistir, com
SporTV, ge TV e Disney+ (que é como a ESPN Brasil aparece ali).

É a grade dos próprios detentores, publicada de forma estruturada. Nada de interpretar
texto de notícia, nada de modelo adivinhando: `scripts/sync-grade-br.mjs` lê, confere cada
confronto contra `temporada.json` e grava. Um jogo que ainda não foi anunciado
simplesmente não tem `liveWatchSources` — que é exatamente o "a definir" do painel.

**Limite:** a agenda cobre uma janela de cinco dias a partir de hoje. Como a escolha dos
jogos de domingo à tarde sai entre terça e quinta, rodar todo dia pega tudo com folga.
Fora dessa janela quem responde são as regras fixas da temporada.

**Precedência ao gravar:** confirmação manual > agenda do ge > regra fixa. O script nunca
sobrescreve o que uma pessoa confirmou à mão.

### Se a agenda do ge sair do ar

O que vem abaixo era o plano original — pesquisa manual em notícia — e continua valendo
como recurso de emergência. A armadilha descrita aqui é real e foi o motivo de procurar
uma fonte estruturada em primeiro lugar.

### A regra que não pode ser quebrada

**Todo anúncio precisa ser datado e conferido contra a rodada corrente.**

Isso não é zelo excessivo. Ao montar este projeto, a busca `NFL semana 2 onde assistir
Brasil SporTV ESPN` devolveu como primeiro resultado um texto da CNN Brasil publicado em
**11 de setembro de 2025** — a grade da temporada anterior, com Steelers x Seahawks na ge TV
e Packers x Commanders no SporTV. Nenhum dos dois confrontos existe em 2026. Uma automação
desatenta teria gravado a grade de 2025 no painel de 2026, com total confiança e nenhum
sinal de erro.

Por isso, antes de gravar qualquer canal:

1. O texto cita a **data exata** do jogo (ex.: "20 de setembro") ou o **confronto exato**?
2. Essa data/confronto batem com `dados/temporada.json`?
3. A publicação é de 2026?

Se qualquer resposta for não, o anúncio é descartado e o jogo fica sem canal. **"A definir"
é informação correta; canal errado não é.**

### Fontes, em ordem de confiabilidade

1. **Programação oficial dos canais** — `sportv.globo.com/agenda`, programação da ESPN Brasil
   no Disney+, canal da ge TV no YouTube. É a fonte primária: se o jogo está na grade
   publicada do canal, está confirmado.
2. **ge.globo.com/futebol-americano/nfl** — cobre SporTV e ge TV, que são do mesmo grupo.
3. **Contas oficiais no X/Instagram** — @NFLBrasil, @sportv, @ESPNBrasil anunciam a escolha
   da rodada, em geral entre terça e quinta.
4. **Imprensa esportiva** — CNN Brasil, Lance, Máquina do Esporte, Olympics.com. Úteis, mas
   é exatamente aqui que mora a armadilha do artigo da temporada passada. Só valem com a
   verificação de data acima, e sempre como confirmação de uma das fontes acima.

Não use agregadores genéricos de "onde assistir" nem sites que republicam programação sem
data de publicação visível.

### Quando a informação costuma sair

| Janela | Quando é anunciada |
|---|---|
| Domingo à tarde (SporTV, ESPN ×2, ge TV) | terça a quinta da mesma semana |
| Thursday Night, Sunday Night, Monday Night | regra fixa da temporada, já aplicada automaticamente |
| Jogos internacionais e Black Friday | caso a caso, às vezes sem detentor no Brasil |
| Playoffs | dezembro/janeiro, junto com a definição dos classificados |

## Logos

Baixados do **Wikimedia Commons** por `scripts/baixar-logos.mjs`, e não de uma busca de
imagens qualquer, por um motivo prático: o Commons publica a licença de cada arquivo de
forma legível por máquina. O script lê essa licença, só aceita domínio público ou licença
livre, e grava licença e URL de origem no catálogo. Quem abrir o repositório consegue
verificar a procedência de cada arquivo sem depender de memória de ninguém.

Doze arquivos vieram por esse caminho: oito emissoras americanas, os logos do Sunday Night
e do Monday Night, e os escudos da AFC e da NFC. O que não tem licença livre no Commons —
NFL Network, NFL+ e o Thursday Night — continua como marca tipográfica desenhada no painel.

Os escudos dos times e os logos dos canais brasileiros vieram do painel v1, extraídos do
base64 embutido nele.

**Por que arquivo e não base64:** o navegador cacheia o arquivo entre visitas, os JSONs
continuam legíveis, o diff do git continua pequeno e trocar um logo é substituir um arquivo.
Foi justamente o base64 dentro do HTML que fez o painel v1 pesar 154 KB, dos quais ~95% eram
imagem que ninguém conseguia editar.

## O que é regra fixa e não precisa de pesquisa

Aplicado automaticamente por `scripts/aplicar-regras-br.mjs`:

- **SporTV** — todo Thursday Night e todo Sunday Night
- **ESPN** — todo Monday Night
- **Netflix** — os jogos que a própria Netflix transmite globalmente

Isso cobre 44 jogos da temporada sem nenhuma busca. Sobra a escolha de domingo à tarde, que
é o trabalho real de cada rodada.

Atenção a um detalhe que já enganou: **Prime Video nos EUA não significa SporTV no Brasil
automaticamente.** O pacote do Thursday Night é do Prime lá e do SporTV aqui, mas o jogo de
Black Friday também é do Prime e **não** tem detentor definido no Brasil. Por isso a regra
exige que o jogo seja numa quinta-feira, e não apenas que a emissora americana seja o Prime.
