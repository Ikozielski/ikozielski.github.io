# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Site pessoal - Iury Kozielski

## Estado atual

Projeto ainda não implementado: esta pasta (`Front/`) só contém um
`site.html` vazio (placeholder). Nenhuma página, CSS, JS ou asset foi
criado ainda — tudo abaixo é a especificação a seguir na implementação.
Não há build tool, linter ou test runner configurado (e não se espera que
haja, dado o stack — ver "Stack tecnológica"). Não há comandos de
build/lint/test para rodar até que o projeto comece a ser implementado.

## Sobre o projeto

Site pessoal do Iury, mais parecido com uma "wiki sobre mim" do que um portfólio
tradicional engessado. Combina currículo profissional (game dev, foco em
transição para Unity/C#), projetos de jogos, e canais de YouTube. Foge do
formato "PDF de currículo" e traz mais personalidade.

Hospedagem: GitHub Pages (estático, gratuito). Domínio inicial:
`ikozielski.github.io` (domínio próprio pode vir no futuro, mas não é
prioridade agora).

## Stack tecnológica

- **HTML + CSS + JavaScript puro** (sem framework JS por enquanto)
- **Tailwind CSS** para estilização (visual moderno, clean, sem "cara" de
  template genérico)
- Sem build tool complexo — manter simples de dar deploy no GitHub Pages
- Decisão consciente: React foi considerado, mas descartado por enquanto
  porque o site é majoritariamente estático. Se um dia migrar para React,
  a estrutura de conteúdo, Tailwind e a lógica do backend continuam
  reaproveitáveis — só a camada de apresentação mudaria.

## Estrutura de pastas (mono-repo com frontend e backend separados)

Estrutura real no disco (raiz do repositório Git é `Meu Site/Meu Site/`,
um nível acima desta pasta):

```
Meu Site/Meu Site/     <- raiz do repositório Git (.git está aqui)
├── Front/             <- este projeto, onde o Claude Code roda
│   ├── site.html       (placeholder vazio — vira index.html + demais páginas)
│   ├── css/
│   ├── js/
│   └── assets/         (imagens, ícones)
└── Back/               <- vazio por enquanto, feature futura (ver abaixo)
```

Estrutura de páginas planejada dentro de `Front/`:
`index.html`, `sobre.html`, `projetos.html`, `canal-cs2.html`,
`canal-pessoal.html`.

Importante: os commits são feitos a partir da raiz do repositório
(`Meu Site/Meu Site/`), não de dentro de `Front/`, já que é lá que fica o
`.git`.

## Navegação principal

```
Início | Sobre mim | Projetos | Canal CS2 | Canal Pessoal
```

Canal CS2 e Canal Pessoal são dois canais do YouTube **diferentes** — cada
um com sua própria página/seção, não misturar conteúdo dos dois.

## Página inicial (Início)

Layout em duas colunas, estilo "currículo moderno":

- **Coluna esquerda**: foto de perfil, nome, localização (Floresta, PR),
  stack técnica resumida (GameMaker, C#, Unity), botões/links para redes
  sociais e canais do YouTube (mesmo estilo dos botões que já existem no
  README do GitHub: WhatsApp, Instagram, Gmail, LinkedIn, TikTok — mais os
  dois canais do YouTube).
- **Coluna direita/centro**: grid de cards de destaque (não é a lista
  completa de projetos, só os principais) — jogo em destaque, projeto Unity
  em andamento, canal CS2, etc. Cada card tem um ícone/cor de destaque e é
  clicável.
- Abaixo das duas colunas: navegação secundária em cards menores para as
  outras páginas do site (Sobre mim, Projetos, etc.), com ícone + label
  curto.

## Página Projetos

Grid de cards de projetos de jogos, organizados por **categoria**
(ex: Plataforma, Puzzle, Unity). Duas partes:

1. **Filtro por categoria**: botões no topo (Todos, Plataforma, Puzzle,
   Unity...) que filtram a grid via JavaScript (mostrar/esconder cards),
   sem precisar de páginas separadas por categoria. Botão "Todos" fica
   destacado/ativo por padrão.
2. **Cards de projeto**: cada card é um link (`<a>`) inteiro clicável, com:
   - Bloco de capa colorido no topo (usar cor sólida por categoria, sem
     gradiente) com um ícone Tabler centralizado representando o tipo de
     jogo/projeto
   - Nome do projeto
   - Categoria + engine usada (ex: "Plataforma · GML", "Unity · C#")
   - Link para itch.io (ícone de link externo). Se o projeto ainda não
     tiver link (ex: projeto em andamento), mostrar "Em breve" em cinza,
     sem link clicável
   - No futuro, os mesmos cards também vão linkar para a Steam quando os
     jogos forem publicados lá

Visual de referência dos cards: cantos arredondados (12px), borda fina
(0.5px), sem sombra, sem gradiente — flat e clean. Bloco de capa colorido
ocupa a parte de cima do card (~70px de altura), conteúdo texto embaixo
com padding confortável.

## Páginas Canal CS2 / Canal Pessoal

Cada uma com: descrição breve do canal, vídeos em destaque (ou link para o
canal), botão de inscrição/link do YouTube. A página do Canal CS2 também
deve destacar o link do Discord da comunidade do canal (importante para
conversão de audiência).

## Seção de tecnologias usadas (ranking de linguagens)

Reaproveitar a imagem já configurada no README do GitHub (gerada via
deploy próprio na Vercel, com token privado configurado). É só uma tag
`<img>` normal apontando para a URL do gráfico. Decidir na hora se a
versão usada no site conta repositórios privados (`count_private=true`)
ou só os públicos — pensar em qual fica melhor para quem está avaliando o
perfil de fora.

## Convenções de código

Manter livre e flexível (sem regras rígidas de nomenclatura como no
GameMaker), mas com foco em ser fácil de entender:

- Nomes de arquivos, classes CSS e variáveis JS em português ou inglês,
  o que for mais natural para o contexto — não precisa ser 100%
  consistente, mas evitar misturar os dois na mesma palavra
- Comentários no código explicando o "porquê" de trechos não óbvios,
  especialmente em JavaScript (filtro de categoria, fetch do backend
  futuro) — o Iury está aprendendo, então comentários ajudam a entender
  o que cada parte faz
  
- Organizar CSS customizado (fora das classes do Tailwind) em arquivo
  separado por página ou um único `style.css` se for pouca coisa
- Cada página HTML é um arquivo próprio (sem roteador client-side, já
  que não estamos usando framework)

## Feature futura: contador de visualizações por projeto

Ainda não implementar, só ter em mente ao estruturar o HTML dos cards de
projeto (deixar um elemento/id reservado tipo `views-{nome-do-projeto}`
para facilitar adicionar depois).

Ideia: cada card de projeto mostra no rodapé algo como "1.234
visualizações". Plano técnico (para quando for implementado):

- Backend simples na pasta `Back/`, hospedado na Vercel (mesmo
  provedor já usado no projeto do README)
- Banco de dados leve (Vercel KV ou Supabase, ambos com plano gratuito)
  para guardar a contagem por projeto
- Frontend faz um `fetch()` simples para uma API tipo
  `/api/contador/{nome-do-projeto}` e atualiza o número na tela via
  JavaScript puro (sem necessidade de React para isso)
- Não depende da escolha de frontend puro vs React — o contador funciona
  do mesmo jeito nos dois casos

## Fora de escopo por enquanto

- Fotografia (removido da estrutura de navegação, não incluir)
- Domínio customizado (ficar no `.github.io` por enquanto)
- Formulário de contato com backend (se necessário no curto prazo, usar
  serviço pronto tipo Formspree ou EmailJS ao invés de construir backend
  próprio só para isso)
