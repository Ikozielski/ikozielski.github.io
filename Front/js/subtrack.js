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
