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

Não existe API. A informação sai em anúncios dispersos durante a semana.

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
