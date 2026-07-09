// Contador "SubTrack" do Canal CS2 — busca o número de inscritos na YouTube Data API
// e atualiza o painel na página. Só roda em canal-cs2.html.
// Depende de js/youtube.js (precisa vir carregado antes) pra YT_API_KEY e a busca
// de perfil/últimos vídeos, que é compartilhada entre os dois canais.
const YT_CHANNEL_ID_CS2 = "UCklRh9sUWmNPsECLFULNkCA";

async function atualizarSubTrack() {
  const elDigitos = document.getElementById("contador-subtrack");
  if (!elDigitos) return;

  try {
    const resposta = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${YT_CHANNEL_ID_CS2}&key=${YT_API_KEY}`
    );
    const dados = await resposta.json();
    const inscritos = dados.items[0].statistics.subscriberCount;
    elDigitos.textContent = inscritos.toString().padStart(6, "0");
  } catch (erro) {
    console.error("Erro ao buscar inscritos do SubTrack:", erro);
  }
}

atualizarSubTrack();
// 60s em vez dos 15s originais: menos chamadas à API por visitante, evita estourar a cota gratuita diária.
setInterval(atualizarSubTrack, 60000);

buscarPerfilEVideosYoutube(YT_CHANNEL_ID_CS2, {
  elViewsId: "cs2-total-views",
  elVideosId: "cs2-ultimos-videos",
});
