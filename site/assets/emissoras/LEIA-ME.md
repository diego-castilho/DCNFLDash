# Logos das emissoras americanas

Os arquivos aqui foram baixados do Wikimedia Commons por `scripts/baixar-logos.mjs`, que
só aceita arquivos em domínio público ou sob licença livre. A licença e a URL de origem de
cada um ficam registradas em `dados/emissoras-eua.json`.

Duas emissoras não têm arquivo — NFL Network e NFL+ não têm logo com licença livre no
Commons. Para elas o painel desenha a marca tipográfica, que é o comportamento padrão
quando o arquivo não existe.

Para trocar qualquer logo, substitua o arquivo mantendo o caminho que o catálogo indica
em `logo`, ou aponte o catálogo para o novo caminho. Formato: qualquer coisa que o
navegador renderize (`.svg`, `.png`, `.webp`). Altura de exibição: 15 px no cartão do jogo,
20 px na lista do rodapé.

Os logos aparecem em chips claros porque a maioria é arte preta sobre transparente e
sumiria no fundo escuro do painel. Um logo que já seja claro deve receber
`"fundo": "escuro"` no catálogo para ganhar chip escuro.

As marcas pertencem aos respectivos titulares e aparecem aqui apenas para identificar
quem transmite cada jogo.
