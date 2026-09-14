# Tarefa agendada — atualizar o calendário NFL/Steelers

**Cadência:** diária, 04:00 (horário de Brasília)
**Pasta:** a pasta local onde está `nfl-steelers-brasil-2026.html`
**Nome sugerido:** Atualizar calendário NFL

---

## Prompt da tarefa

Copie tudo abaixo da linha para o campo **Prompt** da tarefa.

---

Abra o arquivo `nfl-steelers-brasil-2026.html` nesta pasta. Ele é um calendário da temporada 2026/27 da NFL focado no Pittsburgh Steelers, com o canal brasileiro de cada jogo. Sua função é mantê-lo atualizado. Responda sempre em português.

Toda a informação viva fica num bloco `const` no topo da tag `<script>`: `SEMANAS`, `STEELERS`, `NETFLIX`, `CANAIS`, `TIMES` e `ATUALIZADO_EM`. **Edite apenas esse bloco.** Não mexa em HTML, CSS, nas funções de renderização nem nos escudos em base64.

### 1. Placares

Para cada jogo em `SEMANAS` cujo horário já passou e que ainda não tem o campo `placar`, busque o resultado final e adicione:

```js
placar:{f:24,c:17}
```

`f` é o time visitante e `c` o mandante — a mesma ordem dos campos `f:` e `c:` do jogo. Se um jogo tiver `parcial:"..."` e já tiver terminado, substitua pelo placar final e **remova o campo `parcial`**. Se um jogo estiver em andamento no momento da execução, deixe como está.

Prefira a ferramenta de dados esportivos, quando disponível, à busca na web — ela devolve o placar estruturado e evita erro de leitura.

### 2. Canais dos jogos de domingo à tarde

Esta é a parte que mais muda e a razão principal da tarefa. No Brasil, a cada rodada:

- **SporTV** escolhe 1 jogo de domingo à tarde (além de todas as quintas e domingos à noite, que já são fixos)
- **ESPN** escolhe 2 jogos de domingo à tarde (além de todas as segundas, fixas)
- **ge TV** escolhe 1 jogo de domingo à tarde, transmitido de graça no YouTube

Procure os anúncios da rodada mais próxima. Buscas que funcionam: `NFL semana [N] onde assistir Brasil SporTV ESPN`, `NFL [data] transmissão ge TV`, ou a programação dos próprios canais. Ao encontrar, troque `canais:["tbd"]` do jogo correspondente por `["sportv"]`, `["espn"]`, `["getv"]`, ou uma combinação como `["sportv","getv"]`.

**Não adivinhe.** Se não achar o anúncio, deixe `["tbd"]` — o "a definir" na página é informação correta, um canal errado não é.

### 3. Rodada nova

Mantenha três semanas carregadas: a anterior, a atual e a próxima. Quando a rodada mais antiga ficar para trás, remova o bloco dela e acrescente o da próxima, copiando a estrutura existente. Cada dia precisa do campo `data:"AAAA-MM-DD"` — é dele que sai todo o cálculo de horário, estado ao vivo e seleção automática da semana.

Horários vão em **Brasília**. Até 1º de novembro de 2026 o fuso do leste dos EUA está em horário de verão e a conversão é +1 hora; a partir daí, +2 horas.

### 4. Situação dos jogos do Steelers

No array `STEELERS`, atualize cada jogo conforme as informações forem se confirmando:

- `status:"ok"` — confirmado em canal brasileiro, com `st:"SporTV"` ou `st:"ESPN"` ou `st:"ge TV"`
- `status:"fora"` — a rodada passou e nenhum canal brasileiro pegou; `st:"ficou fora da TV brasileira"`
- `status:"risco"` — ainda depende da escolha semanal
- `status:"duvida"` — jogo sem detentor definido no Brasil (Paris, Black Friday)

Depois de cada jogo do Pittsburgh, acrescente o resultado: `res:{v:true, p:"20 x 13"}`, onde `v` é `true` na vitória e `false` na derrota. A campanha do time no painel de números se calcula sozinha a partir daí.

Preencha o campo `iso` de jogos cujo horário for anunciado, no formato `"2026-11-29T15:00:00-03:00"`.

### 5. Mudanças de grade

Verifique se houve flexed schedule — a NFL remaneja jogos para o horário nobre com algumas semanas de antecedência, e isso muda tanto o horário quanto o canal. Confira também alterações em jogos com data ainda aberta (Semanas 16 e 18) e o confronto do jogo de sábado da Netflix na Semana 18, que é definido no fim da temporada. Ajuste o array `NETFLIX` se algum desses jogos for confirmado.

### 6. Fechamento

Atualize `ATUALIZADO_EM` com a data e hora da execução.

Antes de salvar, valide que o script continua íntegro:

```bash
node -e "const s=require('fs').readFileSync('nfl-steelers-brasil-2026.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1]; new Function(s); console.log('sintaxe ok')"
```

Se der erro, desfaça a alteração e refaça com mais cuidado — é preferível a página ficar um dia desatualizada a ficar quebrada.

Ao terminar, escreva um resumo curto: quais placares entraram, quais canais foram confirmados, o que mudou de grade e o que continua pendente. Se nada tiver mudado desde a última execução, diga só isso, em uma linha.

---

*Criado por Diego Castilho*
