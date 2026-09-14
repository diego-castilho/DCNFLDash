# Gitflow

## Branches de longa vida

- **`main`** — o que está publicado. Todo push aqui dispara a publicação no Pages.
- **`develop`** — integração. Toda feature nasce e volta para cá.

## Branches de trabalho

| Prefixo | Para quê | Sai de | Volta para |
|---|---|---|---|
| `feature/` | funcionalidade nova | `develop` | `develop` |
| `fix/` | correção que não é urgente | `develop` | `develop` |
| `hotfix/` | painel publicado quebrado | `main` | `main` **e** `develop` |
| `release/` | preparo de versão (só se precisar de ajuste) | `develop` | `main` e `develop` |

Merge sempre com `--no-ff`, para que o histórico mostre onde cada trabalho começou e
terminou:

```bash
git checkout develop
git checkout -b feature/radar-de-transmissao
# ... trabalho ...
git checkout develop && git merge --no-ff feature/radar-de-transmissao
git checkout main && git merge --no-ff develop && git tag -a v0.3.0 -m "..."
git push origin main develop --tags
```

## A exceção: commits de dados

O sync automático commita **direto em `main`**, sem branch e sem PR.

Isso é deliberado. `dados/temporada.json` é conteúdo, não código: ele não tem revisão
humana possível (é transcrição de API) e precisa chegar ao painel em minutos, não em ciclos
de revisão. A proteção contra dado ruim não é o PR, é o `scripts/validar.mjs` que roda
antes do commit — se reprova, nada é commitado.

Esses commits são identificáveis pelo autor `dcnfldash-bot` e pelo assunto
`dados: sync ESPN — …`.

Mudança de **código** nunca segue esse caminho, nem quando é de uma linha.

## Mensagens de commit

`tipo: assunto no imperativo, em minúscula`

Tipos em uso: `feat`, `fix`, `docs`, `dados`, `chore`, `refactor`.

O corpo explica **por quê**, não o quê — o diff já mostra o quê. Exemplo real deste
repositório:

```
fix: trata confrontos de playoff sem times e horários não fechados

A ESPN devolve TBD nos dois lados dos jogos de playoff e um horário de fachada
nos jogos de fim de temporada ainda sujeitos a flex. Os dois casos passavam pela
validação como dado bom. Agora viram aDefinir e horarioAConfirmar.
```

## Versões

`vMAJOR.MINOR.PATCH`, com tag anotada no merge para `main`.

- **MINOR** — bloco novo no painel, script novo, mudança na forma dos dados
- **PATCH** — correção de comportamento ou de apresentação
- **MAJOR** — reservado para uma mudança que quebre o formato de `dados/`

## Antes de qualquer merge para `main`

```bash
npm run validar    # tem que passar
npm run servir     # abrir e olhar: o painel ainda faz sentido?
```

O CI roda o validador em todo push e PR nas duas branches de longa vida, mas rodar antes
evita descobrir no vermelho.
