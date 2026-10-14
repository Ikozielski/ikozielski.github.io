// Lista manual das promoções do site Direto Games Brasil.
// Promoções da Instant Gaming NÃO vêm daqui: coloque o link no links.txt e rode
// ferramentas/atualizar-promocoes.py. Esta lista é pras outras lojas (Steam, Epic...).
// Pra adicionar uma promoção, copie o exemplo abaixo pra dentro do array e preencha.
// Promoções com "validaAte" no passado somem sozinhas da página, então não precisa
// apagar as antigas na hora (mas vale limpar de vez em quando).
// Estas aparecem depois das da Instant Gaming na ordem "Em destaque".
//
// Quando rolar a parceria com a API da Instant Gaming, este arquivo deixa de ser
// usado: só a função buscarPromocoes() em js/promocoes.js muda.
//
// Campos:
//   jogo           nome do jogo (ou produto, no caso de hardware)
//   plataforma     onde o jogo ativa (ex: "Steam", "Epic Games", "PlayStation", "Xbox",
//                  "Nintendo") — também é usado pra descobrir a categoria abaixo
//   categoria      "PC", "PlayStation", "Xbox" ou "Nintendo" (opcional: se ficar vazio, é
//                  deduzido pela plataforma — Steam/Epic/GOG viram "PC", por exemplo)
//   tipo           "jogo" ou "giftcard" (opcional: padrão é "jogo"; itens da loja
//                  "Hardware" já são tratados como hardware)
//   loja           precisa ser um destes, pra funcionar no filtro da lateral:
//                  "Instant Gaming", "Steam", "Epic Games", "GOG", "Hardware"
//   precoOriginal  preço cheio em reais (número, ex: 249.9)
//   precoPromo     preço com desconto em reais (número)
//   imagem         URL da capa (opcional; sem ela o card mostra um ícone)
//   link           link da promoção. Pra Instant Gaming pode colar o link normal do jogo:
//                  o "?igr=DiretoGamesBrasil" de afiliado é adicionado sozinho
//   cupom          código de cupom, se tiver (opcional)
//   menorHistorico true se for o menor preço que o jogo já teve (opcional)
//   esgotado       true quando a oferta acabar mas você quiser manter o card (opcional)
//   validaAte      último dia da promoção, no formato "AAAA-MM-DD" (opcional)
//
// Exemplo:
// {
//   jogo: "Nome do Jogo",
//   plataforma: "Steam",
//   tipo: "jogo",
//   loja: "Instant Gaming",
//   precoOriginal: 249.9,
//   precoPromo: 89.9,
//   imagem: "https://...",
//   link: "https://www.instant-gaming.com/...",
//   cupom: "",
//   menorHistorico: true,
//   esgotado: false,
//   validaAte: "2026-10-31",
// },
const PROMOCOES_MANUAIS = [];
