// Funções compartilhadas pra buscar dados públicos do YouTube (perfil do canal e
// últimos vídeos longos, sem Shorts) — usadas tanto no Canal CS2 quanto no Canal
// Pessoal, cada página passando seu próprio channelId e ids dos elementos.
//
// A chave abaixo fica exposta no código (site estático, sem backend). Isso só é
// seguro porque ela está restrita por referrer HTTP no Google Cloud Console
// (liberada só para ikozielski.github.io) — sem essa restrição, qualquer um
// poderia copiar a chave e usá-la.
const YT_API_KEY = "AIzaSyA6upTHpZIR1-hMXIgSolEdwiyXi1_Yxjg";

// elementos = { elInscritosId, elViewsId, elVideosId } — passe só os que existirem na página.
async function buscarPerfilEVideosYoutube(channelId, elementos) {
  const elInscritos = elementos.elInscritosId && document.getElementById(elementos.elInscritosId);
  const elViews = elementos.elViewsId && document.getElementById(elementos.elViewsId);
  const elVideos = elementos.elVideosId && document.getElementById(elementos.elVideosId);
  if (!elInscritos && !elViews && !elVideos) return;

  try {
    const respostaCanal = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails&id=${channelId}&key=${YT_API_KEY}`
    );
    const dadosCanal = await respostaCanal.json();
    const canal = dadosCanal.items[0];

    if (elInscritos) {
      const inscritos = Number(canal.statistics.subscriberCount).toLocaleString("pt-BR");
      elInscritos.textContent = `${inscritos} inscritos`;
    }
    if (elViews) {
      const totalViews = Number(canal.statistics.viewCount).toLocaleString("pt-BR");
      elViews.textContent = `${totalViews} visualizações totais`;
    }
    if (elVideos) {
      const uploadsPlaylistId = canal.contentDetails.relatedPlaylists.uploads;
      await renderizarUltimosVideosYoutube(uploadsPlaylistId, elVideos);
    }
  } catch (erro) {
    console.error("Erro ao buscar perfil do canal:", erro);
    if (elInscritos) elInscritos.textContent = "Inscritos indisponíveis";
    if (elViews) elViews.textContent = "Visualizações indisponíveis";
  }
}

async function renderizarUltimosVideosYoutube(uploadsPlaylistId, elVideos) {
  try {
    // Alguns canais postam muito mais Shorts do que vídeo longo, então às vezes uma
    // única página de 50 uploads recentes não é suficiente pra achar 3 vídeos longos.
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
