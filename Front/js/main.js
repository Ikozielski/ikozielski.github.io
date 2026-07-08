// Filtro de categoria da página Projetos.
// Em vez de páginas separadas por categoria, só escondemos/mostramos os cards
// via classList — mais simples de manter sem framework nem roteador.
const filtros = document.querySelectorAll(".filtro-btn");
const cards = document.querySelectorAll("[data-card-categoria]");

filtros.forEach((btn) => {
  btn.addEventListener("click", () => {
    const categoria = btn.dataset.filtro;

    filtros.forEach((b) => b.classList.remove("ativo"));
    btn.classList.add("ativo");

    cards.forEach((card) => {
      const mostrar = categoria === "todos" || card.dataset.cardCategoria === categoria;
      card.classList.toggle("hidden", !mostrar);
    });
  });
});
