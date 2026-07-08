# Site Pessoal — Iury Kozielski

Site pessoal do Iury, uma espécie de "wiki sobre mim" em vez de um portfólio
engessado em formato de PDF. Reúne currículo (foco em game dev, transição
para Unity/C#), projetos de jogos e os canais do YouTube, tudo em um só
lugar e com mais personalidade do que um currículo tradicional.

**Site publicado:** https://ikozielski.github.io/

## Stack

- HTML, CSS e JavaScript puro (sem framework)
- Tailwind CSS para estilização
- Hospedagem estática no GitHub Pages, com deploy automático via GitHub Actions

## Decisões técnicas

**Por que sem framework (React, etc.)?** O site é majoritariamente
estático — não tem estado complexo pra gerenciar, roteamento client-side
ou componentização pesada que justifique o custo de um framework. HTML +
CSS + JS puro mantém o projeto simples de dar manutenção e de publicar no
GitHub Pages, sem build step. Se um dia o site crescer a ponto de precisar
de React, a estrutura de conteúdo e o Tailwind continuam reaproveitáveis —
só a camada de apresentação mudaria.

**Por que ainda não tem backend?** Nenhuma funcionalidade atual depende
de servidor: navegação, filtro de projetos e ranking de linguagens rodam
inteiramente no navegador ou consomem serviços de terceiros. Já existe
planejamento para um backend simples no futuro, quando fizer sentido
adicionar funcionalidades que precisem de um servidor.

## Estrutura de pastas

Mono-repo com frontend e backend separados:

```
Meu Site/          <- raiz do repositório Git
├── Front/         <- frontend do site (HTML, CSS, JS, assets)
│   ├── index.html, sobre.html, projetos.html,
│   │   canal-cs2.html, canal-pessoal.html
│   ├── css/
│   ├── js/
│   └── assets/
├── Back/           <- backend, vazio por enquanto (feature futura)
└── .github/workflows/  <- workflow de deploy do GitHub Pages
```

## Funcionalidades atuais

- Navegação entre as páginas do site (Início, Sobre mim, Projetos, Canal
  CS2, Canal Pessoal)
- Grid de projetos filtrável por categoria, com link direto pro itch.io
  de cada jogo
- Páginas dedicadas para os dois canais do YouTube (Canal CS2 e Canal
  Pessoal), cada um com seu próprio conteúdo
- Ranking das linguagens mais usadas nos repositórios do GitHub,
  exibido direto na página inicial
