// Perfil e últimos vídeos do Canal Pessoal. Depende de js/youtube.js (precisa vir
// carregado antes) pra YT_API_KEY e a busca de perfil/últimos vídeos compartilhada.
const YT_CHANNEL_ID_PESSOAL = "UCfFUdzX28aYWB5JNzh2PHMA";

buscarPerfilEVideosYoutube(YT_CHANNEL_ID_PESSOAL, {
  elInscritosId: "pessoal-inscritos",
  elViewsId: "pessoal-total-views",
  elVideosId: "pessoal-ultimos-videos",
});
