// Menu mobile: a nav horizontal do header some abaixo de md (não cabe com 5 links),
// vira um botão hamburguer que abre/fecha uma lista dropdown com os mesmos links.
const btnMenuMobile = document.getElementById("btn-menu-mobile");
const menuMobile = document.getElementById("menu-mobile");

if (btnMenuMobile && menuMobile) {
  btnMenuMobile.addEventListener("click", () => {
    menuMobile.classList.toggle("hidden");
    const aberto = !menuMobile.classList.contains("hidden");
    btnMenuMobile.setAttribute("aria-expanded", String(aberto));
    btnMenuMobile.innerHTML = aberto ? '<i class="ti ti-x"></i>' : '<i class="ti ti-menu-2"></i>';
  });
}

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

// Popup do email: abre um modal com o endereço em destaque em vez de mailto:,
// já que mailto: não faz nada quando o visitante não tem cliente de email padrão configurado no SO.
const btnEmail = document.getElementById("btn-email");
const modalEmail = document.getElementById("modal-email");

if (btnEmail && modalEmail) {
  const abrirModalEmail = () => modalEmail.classList.remove("hidden");
  const fecharModalEmail = () => modalEmail.classList.add("hidden");

  btnEmail.addEventListener("click", abrirModalEmail);
  modalEmail.querySelectorAll("[data-modal-fechar]").forEach((el) => {
    el.addEventListener("click", fecharModalEmail);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") fecharModalEmail();
  });

  const btnCopiarEmail = document.getElementById("btn-copiar-email");
  const textoEmail = document.getElementById("texto-email");

  btnCopiarEmail.addEventListener("click", async () => {
    await navigator.clipboard.writeText(textoEmail.textContent.trim());

    // Feedback rápido de "copiado" no próprio botão, depois volta ao texto original
    const textoOriginal = btnCopiarEmail.innerHTML;
    btnCopiarEmail.innerHTML = '<i class="ti ti-check"></i> Copiado!';
    setTimeout(() => {
      btnCopiarEmail.innerHTML = textoOriginal;
    }, 1500);
  });
}
