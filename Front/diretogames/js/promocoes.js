// Grade de promoções do site Direto Games Brasil, com filtro por loja, por faixa de
// preço, busca por nome e ordenação. Depende de js/promocoes-instant-gaming.js e
// js/promocoes-dados.js (carregados antes).

// Única função que sabe DE ONDE vêm as promoções. Hoje junta duas listas:
// - PROMOCOES_INSTANT_GAMING: gerada pelo ferramentas/atualizar-promocoes.py a partir do links.txt
// - PROMOCOES_MANUAIS: preenchida à mão em promocoes-dados.js (outras lojas)
// Quando tiver a API da Instant Gaming, troca o corpo por um fetch() e converte a
// resposta pro mesmo formato de objeto — o resto do arquivo continua igual.
// Já é async pra que essa troca não mude quem chama.
async function buscarPromocoes() {
  return [...PROMOCOES_INSTANT_GAMING, ...PROMOCOES_MANUAIS];
}

// Estado dos filtros. Tudo é refeito a partir daqui em renderizarGrade(), em vez de
// esconder/mostrar cards um por um — assim busca, filtros e ordem se combinam sem conflito.
const estado = {
  promocoes: [],
  loja: "todas",
  preco: "qualquer",
  tipo: "todos",
  categoria: "todas",
  busca: "",
  ordem: "destaque",
  pagina: 1, // página atual da paginação (1, 2, 3...)
};

// Com ~200 promoções, montar tudo de uma vez deixa a página pesada (200 imagens) e
// longa demais. Divide em páginas de CARDS_POR_PAGINA, com paginação numerada embaixo.
const CARDS_POR_PAGINA = 24;

const elGrade = document.getElementById("grade-promocoes");
const elContador = document.getElementById("contador-promocoes");
const elPaginacao = document.getElementById("paginacao");

// Promoção sem data vale sempre; com data, vale até o fim daquele dia.
function promocaoAtiva(promo) {
  if (!promo.validaAte) return true;
  return new Date(`${promo.validaAte}T23:59:59`) >= new Date();
}

function calcularDesconto(promo) {
  if (!(promo.precoOriginal > 0)) return 0;
  return Math.round((1 - promo.precoPromo / promo.precoOriginal) * 100);
}

// Código de afiliado da Instant Gaming. Todo link pra instant-gaming.com ganha
// "?igr=DiretoGamesBrasil" automaticamente, então na lista dá pra colar o link
// normal do jogo. Se o link já tiver outro igr, ele é substituído pelo nosso.
const CODIGO_AFILIADO_INSTANT_GAMING = "DiretoGamesBrasil";

function adicionarAfiliado(link) {
  try {
    const url = new URL(link);
    if (url.hostname.endsWith("instant-gaming.com")) {
      url.searchParams.set("igr", CODIGO_AFILIADO_INSTANT_GAMING);
    }
    return url.toString();
  } catch {
    return link; // link mal formatado: deixa como está em vez de quebrar o card
  }
}

function formatarReais(valor) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Os dados podem vir de uma API externa no futuro, então escapa o texto antes de
// colocar no innerHTML (evita que um nome de jogo com "<" quebre ou injete HTML).
function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}

// Compara sem diferenciar maiúscula/acento, pra busca "pokemon" achar "Pokémon".
function normalizar(texto) {
  return (texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Tipo da promoção: "jogo" (padrão), "giftcard" ou "hardware". Hardware é deduzido
// pela loja, pra não precisar preencher "tipo" em todo item da lista.
function descobrirTipo(promo) {
  if (promo.tipo) return promo.tipo;
  return promo.loja === "Hardware" ? "hardware" : "jogo";
}

// Plataformas pro filtro (PC, PlayStation, Xbox, Nintendo) — um produto pode ter mais
// de uma (ex: Forza é PC e Xbox). Ordem de prioridade:
// 1. "categorias" (lista, preenchida pelo script da Instant Gaming)
// 2. "categoria" (texto, pra quem preenche à mão em promocoes-dados.js)
// 3. dedução pelo campo "plataforma": Steam, Epic, GOG etc. são PC
// Retorna [] quando não dá pra saber.
const PLATAFORMAS_PC = ["steam", "epic", "gog", "ea app", "origin", "ubisoft", "battle.net", "rockstar", "microsoft store", "pc"];

function descobrirCategorias(promo) {
  if (Array.isArray(promo.categorias) && promo.categorias.length) return promo.categorias;
  if (promo.categoria) return [promo.categoria];
  const plataforma = normalizar(promo.plataforma);
  if (!plataforma) return [];
  if (plataforma.includes("playstation") || plataforma.includes("psn")) return ["PlayStation"];
  if (plataforma.includes("xbox")) return ["Xbox"];
  if (plataforma.includes("nintendo") || plataforma.includes("switch")) return ["Nintendo"];
  if (PLATAFORMAS_PC.some((nome) => plataforma.includes(nome))) return ["PC"];
  return [];
}

function passaNosFiltros(promo) {
  if (estado.tipo !== "todos" && descobrirTipo(promo) !== estado.tipo) return false;
  if (estado.categoria !== "todas" && !descobrirCategorias(promo).includes(estado.categoria)) return false;
  if (estado.loja !== "todas" && promo.loja !== estado.loja) return false;
  if (estado.preco === "historico" && !promo.menorHistorico) return false;
  if (!["qualquer", "historico"].includes(estado.preco) && promo.precoPromo > Number(estado.preco)) return false;
  if (estado.busca && !normalizar(promo.jogo).includes(normalizar(estado.busca))) return false;
  return true;
}

// No filtro de plataforma "Todas", o mesmo jogo em várias plataformas vira um card só,
// pra grade não ficar repetida. O card mostrado é o de PC (se tiver; senão o primeiro
// da lista) e guarda em "outrasPlataformas" as demais, pra aparecer "Também em ..." nele.
// Agrupa por nome + tipo: o script já tira o "- PC (Steam)"/"- PS5" do nome, então o
// mesmo jogo fica com o mesmo nome em todas as plataformas.
function agruparPorJogo(lista) {
  const grupos = new Map();
  for (const promo of lista) {
    const chave = `${normalizar(promo.jogo)}|${descobrirTipo(promo)}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(promo);
  }

  return [...grupos.values()].map((versoes) => {
    const principal = versoes.find((p) => descobrirCategorias(p).includes("PC")) || versoes[0];
    // A plataforma "da vitrine" do card é PC (se tiver) ou a primeira do principal; todas
    // as outras — de outras versões ou do mesmo produto, tipo Forza PC + Xbox — viram "Também em".
    const categoriasPrincipal = descobrirCategorias(principal);
    const vitrine = categoriasPrincipal.includes("PC") ? "PC" : categoriasPrincipal[0];
    const outrasPlataformas = [...new Set(versoes.flatMap(descobrirCategorias))]
      .filter((c) => c !== vitrine);
    return { ...principal, outrasPlataformas };
  });
}

function ordenar(lista) {
  // "destaque" mantém a ordem do array: seus destaques do links.txt primeiro, depois os
  // mais vendidos da Instant Gaming em ordem de vendas. Esgotadas sempre vão pro fim.
  const copia = [...lista];
  if (estado.ordem === "desconto") copia.sort((a, b) => calcularDesconto(b) - calcularDesconto(a));
  if (estado.ordem === "preco") copia.sort((a, b) => a.precoPromo - b.precoPromo);
  return copia.sort((a, b) => Number(!!a.esgotado) - Number(!!b.esgotado));
}

function montarCard(promo) {
  const desconto = calcularDesconto(promo);
  const validade = promo.validaAte
    ? `Até ${new Date(`${promo.validaAte}T00:00:00`).toLocaleDateString("pt-BR")}`
    : "";
  const capa = promo.imagem
    ? `<img src="${escaparHtml(promo.imagem)}" alt="Capa de ${escaparHtml(promo.jogo)}" loading="lazy" class="w-full aspect-video object-cover" />`
    : `<div class="w-full aspect-video bg-neutral-900 flex items-center justify-center"><i class="ti ti-device-gamepad-2 text-5xl text-neutral-700"></i></div>`;
  const origem = [promo.plataforma, promo.loja].filter(Boolean).map(escaparHtml).join(" · ");
  // Cada plataforma extra é um botãozinho que já ativa aquele filtro (ver clique em iniciar()).
  const outras = (promo.outrasPlataformas || [])
    .map((c) => `<button type="button" class="underline hover:text-marca transition" data-ir-categoria="${escaparHtml(c)}">${escaparHtml(c)}</button>`)
    .join(", ");

  // Card esgotado fica apagado e sem botão, mas continua aparecendo (prova social das ofertas).
  return `
    <article class="rounded-xl bg-fundo-card border border-fundo-borda overflow-hidden flex flex-col ${promo.esgotado ? "opacity-50 grayscale" : "hover:border-marca/60"} transition">
      <div class="relative">
        ${capa}
        <div class="absolute top-2 left-2 flex flex-col items-start gap-1">
          ${promo.destaque && !promo.esgotado ? '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-white text-black inline-flex items-center gap-1"><i class="ti ti-star-filled"></i>DESTAQUE</span>' : ""}
          ${promo.esgotado ? '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-red-600 text-white">ESGOTADO</span>' : ""}
          ${promo.menorHistorico && !promo.esgotado ? '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500 text-black">MENOR HISTÓRICO</span>' : ""}
          ${promo.preVenda && !promo.esgotado ? '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-500 text-black">PRÉ-VENDA</span>' : ""}
        </div>
        ${desconto > 0 ? `<span class="absolute top-2 right-2 px-2 py-0.5 rounded text-sm font-extrabold bg-marca text-black">-${desconto}%</span>` : ""}
      </div>
      <div class="p-4 flex-1 flex flex-col gap-2">
        <h3 class="font-semibold leading-snug line-clamp-2">${escaparHtml(promo.jogo)}</h3>
        <p class="text-xs text-neutral-400">${origem}</p>
        ${outras ? `<p class="text-xs text-neutral-500">Também em ${outras}</p>` : ""}
        <div class="flex items-baseline gap-2 mt-auto pt-2">
          ${desconto > 0 ? `<span class="text-sm text-neutral-500 line-through">${formatarReais(promo.precoOriginal)}</span>` : ""}
          <span class="text-2xl font-bold text-marca">${formatarReais(promo.precoPromo)}</span>
        </div>
        ${promo.cupom ? `<p class="text-xs text-neutral-300">Cupom: <span class="font-mono font-semibold text-marca">${escaparHtml(promo.cupom)}</span></p>` : ""}
        ${validade ? `<p class="text-xs text-amber-400 flex items-center gap-1"><i class="ti ti-clock"></i>${validade}</p>` : ""}
        ${promo.esgotado
          ? '<span class="mt-2 text-center px-4 py-2 rounded-md bg-neutral-800 text-neutral-400 text-sm font-semibold">Oferta encerrada</span>'
          : `<a href="${escaparHtml(adicionarAfiliado(promo.link))}" target="_blank" rel="noopener sponsored" class="mt-2 text-center px-4 py-2 rounded-md bg-marca hover:bg-marca-escuro text-black text-sm font-bold transition inline-flex items-center justify-center gap-2">Ver oferta <i class="ti ti-external-link"></i></a>`}
      </div>
    </article>
  `;
}

// Volta um grupo de filtros pro botão "todos/todas" (o primeiro do grupo) e limpa o
// estado — usado quando o grupo some, pra não ficar um filtro invisível ativo.
function resetarGrupo(idGrupo, chaveEstado, valorPadrao) {
  const botoes = document.querySelectorAll(`#${idGrupo} .filtro`);
  botoes.forEach((b, i) => b.classList.toggle("ativo", i === 0));
  estado[chaveEstado] = valorPadrao;
}

// Os filtros de cima dependem da loja escolhida na lateral:
// - "Todas" e "Instant Gaming": tipo (Jogos/Gift Cards) e plataforma (PC/PlayStation/...)
//   — a Instant Gaming vende pra todas as plataformas
// - Steam/Epic/GOG: só tipo — a loja já define a plataforma (são todas PC)
// - "Hardware": nenhum dos dois, já que não é jogo nem gift card
const LOJAS_COM_FILTRO_DE_PLATAFORMA = ["todas", "Instant Gaming"];

function atualizarFiltrosVisiveis() {
  const mostrarLinha = estado.loja !== "Hardware";
  const mostrarCategoria = LOJAS_COM_FILTRO_DE_PLATAFORMA.includes(estado.loja);

  document.getElementById("linha-filtros").classList.toggle("hidden", !mostrarLinha);
  document.getElementById("grupo-categoria").classList.toggle("hidden", !mostrarCategoria);

  if (!mostrarLinha) resetarGrupo("filtros-tipo", "tipo", "todos");
  if (!mostrarCategoria) resetarGrupo("filtros-categoria", "categoria", "todas");
}

// Quais números aparecem na paginação. Com muitas páginas não cabe tudo, então mostra
// sempre a primeira, a última e as vizinhas da atual, com "…" no meio:
//   página 7 de 50 -> 1 … 6 7 8 … 50
function numerosDaPaginacao(atual, total) {
  const numeros = [];
  for (let n = 1; n <= total; n++) {
    if (n === 1 || n === total || Math.abs(n - atual) <= 1) {
      // "…" só quando pulou números; se pulou só um, mostra ele mesmo (1 2 3 em vez de 1 … 3)
      const anterior = numeros[numeros.length - 1];
      if (anterior !== undefined && n - anterior === 2) numeros.push(n - 1);
      else if (anterior !== undefined && n - anterior > 2) numeros.push("…");
      numeros.push(n);
    }
  }
  return numeros;
}

function renderizarPaginacao(totalPaginas) {
  if (totalPaginas <= 1) {
    elPaginacao.innerHTML = "";
    return;
  }
  const atual = estado.pagina;
  const classeBase = "min-w-9 h-9 px-2 rounded-md border text-sm font-semibold inline-flex items-center justify-center transition";
  const seta = (pagina, icone, rotulo, desativada) => `
    <button type="button" data-pagina="${pagina}" aria-label="${rotulo}" ${desativada ? "disabled" : ""}
      class="${classeBase} border-fundo-borda ${desativada ? "opacity-30 cursor-not-allowed" : "hover:border-marca"}">
      <i class="ti ${icone}"></i>
    </button>`;

  const numeros = numerosDaPaginacao(atual, totalPaginas)
    .map((n) => n === "…"
      ? '<span class="px-1 text-neutral-500">…</span>'
      : `<button type="button" data-pagina="${n}" ${n === atual ? 'aria-current="page"' : ""}
          class="${classeBase} ${n === atual ? "bg-marca border-marca text-black" : "border-fundo-borda hover:border-marca"}">${n}</button>`)
    .join("");

  elPaginacao.innerHTML =
    seta(atual - 1, "ti-chevron-left", "Página anterior", atual === 1) +
    numeros +
    seta(atual + 1, "ti-chevron-right", "Próxima página", atual === totalPaginas);
}

// Qualquer mudança de filtro/busca/ordem volta pra página 1; só a paginação chama
// com manterPagina = true.
function renderizarGrade(manterPagina = false) {
  atualizarFiltrosVisiveis();
  const filtradas = estado.promocoes.filter(passaNosFiltros);
  const visiveis = ordenar(estado.categoria === "todas" ? agruparPorJogo(filtradas) : filtradas);

  const totalPaginas = Math.max(1, Math.ceil(visiveis.length / CARDS_POR_PAGINA));
  if (!manterPagina) estado.pagina = 1;
  estado.pagina = Math.min(Math.max(estado.pagina, 1), totalPaginas);
  renderizarPaginacao(totalPaginas);

  // O contador acompanha os filtros (é o total de todas as páginas, não só da atual).
  const disponiveis = visiveis.filter((p) => !p.esgotado).length;
  elContador.textContent = disponiveis === 1 ? "1 oferta disponível" : `${disponiveis} ofertas disponíveis`;

  if (estado.promocoes.length === 0) {
    elGrade.innerHTML = `
      <div class="col-span-full rounded-xl border border-dashed border-fundo-borda p-10 text-center space-y-3">
        <i class="ti ti-hourglass text-4xl text-marca"></i>
        <p class="text-neutral-300">Nenhuma promoção no ar agora.</p>
        <p class="text-sm text-neutral-500">Se inscreva no canal pra ficar sabendo das próximas ofertas!</p>
      </div>`;
    return;
  }

  if (visiveis.length === 0) {
    elGrade.innerHTML = '<p class="text-neutral-500 text-sm col-span-full">Nenhuma promoção com esses filtros.</p>';
    return;
  }

  const inicio = (estado.pagina - 1) * CARDS_POR_PAGINA;
  elGrade.innerHTML = visiveis.slice(inicio, inicio + CARDS_POR_PAGINA).map(montarCard).join("");
}

// Clique num número ou numa seta: vai pra página e sobe a tela até o topo da grade
// (senão a pessoa fica olhando o rodapé da página nova).
elPaginacao.addEventListener("click", (evento) => {
  const botao = evento.target.closest("[data-pagina]");
  if (!botao || botao.disabled) return;
  estado.pagina = Number(botao.dataset.pagina);
  renderizarGrade(true);
  document.getElementById("topo-promocoes").scrollIntoView({ behavior: "smooth" });
});

// Liga um grupo de botões de filtro: marca o clicado como ativo e grava o valor no estado.
function ligarFiltros(idGrupo, chaveEstado, atributo) {
  const botoes = document.querySelectorAll(`#${idGrupo} .filtro`);
  botoes.forEach((btn) => {
    btn.addEventListener("click", () => {
      botoes.forEach((b) => b.classList.remove("ativo"));
      btn.classList.add("ativo");
      estado[chaveEstado] = btn.dataset[atributo];
      renderizarGrade();
    });
  });
}

ligarFiltros("filtros-loja", "loja", "loja");
ligarFiltros("filtros-preco", "preco", "preco");
ligarFiltros("filtros-tipo", "tipo", "tipo");
ligarFiltros("filtros-categoria", "categoria", "categoria");

document.getElementById("busca-promocao").addEventListener("input", (evento) => {
  estado.busca = evento.target.value.trim();
  renderizarGrade();
});

document.getElementById("ordem-promocao").addEventListener("change", (evento) => {
  estado.ordem = evento.target.value;
  renderizarGrade();
});

// Clique no "Também em PlayStation" de um card: ativa o filtro daquela plataforma.
// Fica num listener só na grade (e não em cada botão) porque os cards são recriados
// a cada renderização.
function irParaCategoria(categoria) {
  const botoes = document.querySelectorAll("#filtros-categoria .filtro");
  botoes.forEach((b) => b.classList.toggle("ativo", b.dataset.categoria === categoria));
  estado.categoria = categoria;
  renderizarGrade();
}

elGrade.addEventListener("click", (evento) => {
  const botao = evento.target.closest("[data-ir-categoria]");
  if (botao) irParaCategoria(botao.dataset.irCategoria);
});

async function iniciar() {
  try {
    estado.promocoes = (await buscarPromocoes()).filter(promocaoAtiva);
    renderizarGrade();
  } catch (erro) {
    console.error("Erro ao carregar promoções:", erro);
    elGrade.innerHTML = '<p class="text-neutral-500 text-sm col-span-full">Não deu pra carregar as promoções agora.</p>';
  }
}

iniciar();
