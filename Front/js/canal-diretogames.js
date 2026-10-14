// Perfil e últimos vídeos do canal Direto Games Brasil. Depende de js/youtube.js
// (precisa vir carregado antes). As promoções ficam no site próprio, em https://diretogamesbrasil.vercel.app/.
const YT_CHANNEL_ID_DIRETOGAMES = "UCLIf-PzzZJUU7PaUxN8LxxQ";

buscarPerfilEVideosYoutube(YT_CHANNEL_ID_DIRETOGAMES, {
  elInscritosId: "diretogames-inscritos",
  elViewsId: "diretogames-total-views",
  elVideosId: "diretogames-ultimos-videos",
});
