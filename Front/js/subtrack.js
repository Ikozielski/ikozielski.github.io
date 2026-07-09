// Contador "SubTrack" do Canal CS2 — busca o número de inscritos na YouTube Data API
// e atualiza o painel na página. Só roda em canal-cs2.html.
//
// A chave abaixo fica exposta no código (site estático, sem backend). Isso só é seguro
// se ela estiver restrita por referrer HTTP no Google Cloud Console (liberada só para
// ikozielski.github.io) — sem essa restrição, qualquer um pode copiar a chave e usá-la.
const YT_API_KEY = "AIzaSyA6upTHpZIR1-hMXIgSolEdwiyXi1_Yxjg";
const YT_CHANNEL_ID = "UCklRh9sUWmNPsECLFULNkCA";

async function atualizarSubTrack() {
  const elDigitos = document.getElementById("contador-subtrack");
  if (!elDigitos) return;

  try {
    const resposta = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${YT_CHANNEL_ID}&key=${YT_API_KEY}`
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

// Perfil do canal (visualizações totais) + últimos vídeos: busca só uma vez ao carregar
// a página (não precisa ficar repetindo, diferente do contador de inscritos acima).
// Usa contentDetails.relatedPlaylists.uploads pra achar a playlist de uploads do canal,
// porque listar vídeos por essa playlist custa bem menos cota da API do que search.list.
async function atualizarPerfilEVideos() {
  const elViews = document.getElementById("cs2-total-views");
  const elVideos = document.getElementById("cs2-ultimos-videos");
  if (!elViews && !elVideos) return;

  try {
    const respostaCanal = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails&id=${YT_CHANNEL_ID}&key=${YT_API_KEY}`
    );
    const dadosCanal = await respostaCanal.json();
    const canal = dadosCanal.items[0];

    if (elViews) {
      const totalViews = Number(canal.statistics.viewCount).toLocaleString("pt-BR");
      elViews.textContent = `${totalViews} visualizações totais`;
    }

    if (elVideos) {
      const uploadsPlaylistId = canal.contentDetails.relatedPlaylists.uploads;
      await renderizarUltimosVideos(uploadsPlaylistId, elVideos);
    }
  } catch (erro) {
    console.error("Erro ao buscar perfil do canal:", erro);
    if (elViews) elViews.textContent = "Visualizações indisponíveis";
  }
}

async function renderizarUltimosVideos(uploadsPlaylistId, elVideos) {
  try {
    // O canal posta muito mais Shorts do que vídeo longo, então às vezes uma única
    // página de 50 uploads recentes não é suficiente pra achar 3 vídeos longos.
    // Vai paginando (nextPageToken) até achar 3 ou passar de ~4 páginas (200 vídeos).
    const videosLongos = [];
    let pageToken = "";
    let paginas = 0;

    while (videosLongos.length < 3 && paginas < 4) {
      const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("playlistId", uploadsPlaylistId);
      url.searchParams.set("maxResults", "50");
      url.searchParams.set("key", YT_API_KEY);
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const respostaPlaylist = await fetch(url);
      const dadosPlaylist = await respostaPlaylist.json();
      paginas++;

      const idsVideos = (dadosPlaylist.items || [])
        .map((item) => item.snippet.resourceId.videoId)
        .join(",");
      if (!idsVideos) break;

      const respostaVideos = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${idsVideos}&key=${YT_API_KEY}`
      );
      const dadosVideos = await respostaVideos.json();

      // O YouTube já permite Shorts de até 3 minutos, então um corte em 60s deixa
      // passar vídeo curto disfarçado de "longo" — usa 180s pra filtrar de verdade.
      for (const video of dadosVideos.items) {
        if (converterDuracaoParaSegundos(video.contentDetails.duration) > 180) {
          videosLongos.push(video);
        }
      }

      pageToken = dadosPlaylist.nextPageToken;
      if (!pageToken) break;
    }

    videosLongos.length = Math.min(videosLongos.length, 3);

    if (videosLongos.length === 0) {
      elVideos.innerHTML = '<p class="text-slate-500 text-sm sm:col-span-3">Nenhum vídeo longo encontrado.</p>';
      return;
    }

    elVideos.innerHTML = videosLongos
      .map((video) => {
        const views = Number(video.statistics.viewCount || 0).toLocaleString("pt-BR");
        return `
          <a href="https://www.youtube.com/watch?v=${video.id}" target="_blank" rel="noopener" class="rounded-xl border border-slate-800 overflow-hidden hover:border-slate-600 transition">
            <img src="${video.snippet.thumbnails.medium.url}" alt="Miniatura do vídeo ${video.snippet.title}" class="w-full aspect-video object-cover" />
            <div class="p-3 space-y-1">
              <h3 class="text-sm font-medium line-clamp-2">${video.snippet.title}</h3>
              <p class="text-xs text-slate-400">${views} visualizações</p>
            </div>
          </a>
        `;
      })
      .join("");
  } catch (erro) {
    console.error("Erro ao buscar últimos vídeos:", erro);
    elVideos.innerHTML = '<p class="text-slate-500 text-sm sm:col-span-3">Não deu pra carregar os vídeos agora.</p>';
  }
}

// Converte duração ISO 8601 (ex: "PT4M13S") em segundos, pra distinguir Short de vídeo longo.
function converterDuracaoParaSegundos(duracaoIso) {
  const partes = duracaoIso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  const horas = parseInt(partes[1] || "0", 10);
  const minutos = parseInt(partes[2] || "0", 10);
  const segundos = parseInt(partes[3] || "0", 10);
  return horas * 3600 + minutos * 60 + segundos;
}

atualizarPerfilEVideos();
