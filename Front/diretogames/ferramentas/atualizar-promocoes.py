"""
Gera diretogames/js/promocoes-instant-gaming.js juntando duas fontes:

1. Destaques: os links que você escolheu em diretogames/links.txt (aparecem primeiro,
   com o selo DESTAQUE).
2. Mais vendidos: os QUANTIDADE_MAIS_VENDIDOS produtos mais vendidos da Instant Gaming
   no Brasil, puxados da mesma busca (Algolia) que o site deles usa.

Pra cada produto, abre a página na Instant Gaming e pega nome, capa, preço em reais e
disponibilidade (o preço em reais do Algolia não é confiável, o da página é).

Roda no seu computador ou no GitHub Actions (.github/workflows/atualizar-promocoes.yml,
todo dia), nunca no site — o site continua 100% estático:
    python Front/diretogames/ferramentas/atualizar-promocoes.py

O arquivo gerado é sempre reescrito do zero. Não precisa instalar nada: só usa a
biblioteca padrão do Python.
"""

import html
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

PASTA_SITE = Path(__file__).resolve().parent.parent
ARQUIVO_LINKS = PASTA_SITE / "links.txt"
ARQUIVO_SAIDA = PASTA_SITE / "js" / "promocoes-instant-gaming.js"

# Quantos mais vendidos puxar além dos destaques do links.txt (0 = só os destaques).
QUANTIDADE_MAIS_VENDIDOS = 200

# Quantas páginas baixar ao mesmo tempo. Baixo de propósito, pra não sobrecarregar a
# Instant Gaming (e não ser bloqueado): 200 produtos levam ~1-2 minutos.
DOWNLOADS_SIMULTANEOS = 4

# Mais vendidos que não são jogo nem crédito de jogo ficam de fora (Windows, Office...).
TRECHOS_NAO_JOGO = ["windows", "office", "antivirus", "vpn", "norton", "kaspersky", "mcafee"]

# Busca da Instant Gaming (Algolia). Essa chave é pública: ela aparece no HTML do site
# deles (window.algoliaConfig) e só permite pesquisar. O índice "_bestsellers_desc" é o
# mesmo da ordenação "Mais vendidos" da busca deles; o filtro é o de região do Brasil.
ALGOLIA_URL = "https://qknhp8tc3y-dsn.algolia.net/1/indexes/*/queries"
ALGOLIA_CABECALHOS = {
    "X-Algolia-Application-Id": "QKNHP8TC3Y",
    "X-Algolia-API-Key": "93946b91c013211f842ddf1819ea880b",
    "Content-Type": "application/json",
    "Referer": "https://www.instant-gaming.com/",
}
ALGOLIA_INDICE = "produits_pt_bestsellers_desc"

# IsThereAnyDeal (ITAD): guarda o menor preço que cada jogo já teve nas lojas oficiais.
# A Instant Gaming não está no ITAD, então o selo MENOR HISTÓRICO significa: "a Instant
# está vendendo por menos (ou igual) que o menor preço que qualquer uma dessas lojas já
# fez no Brasil". Só vale pra jogos de PC (o ITAD não cobre console nem gift card).
# A chave vem da variável de ambiente ITAD_API_KEY (no GitHub: secret ITAD_API_KEY) e
# nunca fica no código. Sem ela, essa etapa é pulada.
ITAD_API = "https://api.isthereanydeal.com"
ITAD_LOJAS = {61: "Steam", 16: "Epic Game Store", 35: "GOG", 50: "Nuuvem", 48: "Microsoft Store"}
ALGOLIA_FILTRO_BRASIL = '(country_whitelist:"BR" OR country_whitelist:"worldwide" OR country_whitelist:"WW") AND (NOT country_blacklist:"BR")'

# Cabeçalhos de navegador em português: sem eles a Instant Gaming pode mostrar
# preço em euro/outra região, ou recusar a requisição.
CABECALHOS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36",
    "Accept-Language": "pt-BR,pt;q=0.9",
}


def baixar_pagina(url):
    """Devolve (html, url_final). A url final importa porque a Instant Gaming
    redireciona /pt/123-buy-... pro slug em português (/pt/123-comprar-...)."""
    requisicao = urllib.request.Request(url, headers=CABECALHOS)
    with urllib.request.urlopen(requisicao, timeout=20) as resposta:
        return resposta.read().decode("utf-8", errors="ignore"), resposta.geturl()


def achar(padrao, texto):
    m = re.search(padrao, texto, re.S)
    return html.unescape(m.group(1)).strip() if m else None


def ler_product_model(pagina):
    """A página tem um 'window.productModel = {...}' com preço, preço cheio e desconto
    do produto principal. É mais confiável que ler o HTML, que tem preços de vários
    outros produtos (recomendados, edições, etc). raw_decode lê só o objeto JSON e
    para no fim dele, ignorando o resto do script."""
    inicio = pagina.find("window.productModel")
    if inicio == -1:
        return None
    inicio = pagina.index("{", inicio)
    modelo, _ = json.JSONDecoder().raw_decode(pagina[inicio:])
    return modelo


def limpar_nome(titulo):
    """'Comprar Sea of Stars - PC (Steam)' -> 'Sea of Stars'
    'Comprar Forza Horizon 6 - PC & XBOX Series X|S (Microsoft Store)' -> 'Forza Horizon 6'"""
    nome = re.sub(r"^(Comprar|Buy)\s+", "", titulo)
    nome = re.sub(r"\s+-\s+(PC|Mac|PlayStation|PS\d|Xbox|Nintendo|Switch)\b.*$", "", nome, flags=re.I)
    nome = re.sub(r"\s*\([^)]*\)$", "", nome)  # "12000 FC Points (EA App)" -> "12000 FC Points"
    return nome.strip()


def descobrir_categorias(texto):
    """Plataformas do produto pro filtro do site: PC, PlayStation, Xbox, Nintendo.
    Pode ter mais de uma (ex: Forza é 'PC & Xbox'). 'texto' junta slug + título."""
    palavras = re.sub(r"[^a-z0-9]+", " ", texto.lower()).split()
    categorias = []
    if "pc" in palavras:
        categorias.append("PC")
    if "playstation" in palavras or "ps4" in palavras or "ps5" in palavras:
        categorias.append("PlayStation")
    if "xbox" in palavras:
        categorias.append("Xbox")
    if "nintendo" in palavras or "switch" in palavras:
        categorias.append("Nintendo")
    return categorias or ["PC"]


def descobrir_plataforma(titulo, categorias):
    """Onde o produto ativa, pra mostrar no card (Steam, Microsoft Store, Rockstar...).
    Vem do que está entre parênteses no fim do título; sem isso, usa a categoria."""
    # Pega o último parênteses do título, que nem sempre está no fim:
    # "Star Wars: Galactic Racer - PC (Steam) - Latin America"
    entre_parenteses = re.findall(r"\(([^)]+)\)", titulo)
    if entre_parenteses:
        return entre_parenteses[-1]
    return " / ".join(categorias)


# Moedas de jogo (Robux, FC Points, UC...) e assinaturas (Game Pass, EA Play) entram
# como gift card: não são jogo, e quem procura "Gift Cards" também procura crédito pra
# gastar dentro do jogo ou pra assinar serviço.
TRECHOS_GIFT_CARD = [
    "vale-presente", "cartao", "gift-card", "-card-", "eshop", "credito",
    "robux", "points", "v-bucks", "minecoins", "platina", "platinum", "moedas", "-uc-", "-nc-",
    "game-pass", "ea-play", "assinatura", "membership",
]


def eh_gift_card(texto):
    return any(trecho in texto for trecho in TRECHOS_GIFT_CARD)


def ler_linhas_do_txt():
    """Cada linha: um link, opcionalmente seguido de opções separadas por '|':
        https://www.instant-gaming.com/pt/123-comprar-jogo/ | menor historico | ate 2026-10-31 | cupom ABC
    Linhas vazias e começando com # são ignoradas."""
    itens = []
    for numero, linha in enumerate(ARQUIVO_LINKS.read_text(encoding="utf-8").splitlines(), start=1):
        linha = linha.strip()
        if not linha or linha.startswith("#"):
            continue
        partes = [p.strip() for p in linha.split("|")]
        link, opcoes = partes[0], partes[1:]
        if "instant-gaming.com" not in link:
            print(f"  linha {numero}: ignorada, não é link da Instant Gaming -> {link}")
            continue
        link = link.split("?")[0]  # tira ?igr, ?itm_source etc.: o site coloca o nosso igr
        link = re.sub(r"instant-gaming\.com/[a-z]{2}/", "instant-gaming.com/pt/", link)  # /en/ -> /pt/
        itens.append((numero, link, opcoes))
    return itens


def aplicar_opcoes(promo, opcoes, rotulo):
    for opcao in opcoes:
        chave = opcao.lower()
        if chave in ("menor historico", "menor histórico"):
            promo["menorHistorico"] = True
        elif chave == "esgotado":
            promo["esgotado"] = True
        elif chave.startswith("ate ") or chave.startswith("até "):
            data = opcao.split(" ", 1)[1].strip()
            try:
                date.fromisoformat(data)
                promo["validaAte"] = data
            except ValueError:
                print(f"  {rotulo}: data inválida '{data}' (use AAAA-MM-DD), ignorada")
        elif chave.startswith("cupom "):
            promo["cupom"] = opcao.split(" ", 1)[1].strip()
        else:
            print(f"  {rotulo}: opção desconhecida '{opcao}', ignorada")


def buscar_mais_vendidos(quantidade):
    """Lista de links dos mais vendidos no Brasil, em ordem de vendas, com uma 'dica' do
    Algolia de que o produto é crédito/assinatura (vira gift card no site). Pula o que
    está sem estoque e o que não é jogo. Pede de 100 em 100 até juntar 'quantidade'."""
    encontrados = []
    pagina = 0
    while len(encontrados) < quantidade and pagina < 10:
        corpo = json.dumps({"requests": [{
            "indexName": ALGOLIA_INDICE,
            "params": urllib.parse.urlencode({
                "query": "", "hitsPerPage": 100, "page": pagina, "filters": ALGOLIA_FILTRO_BRASIL,
            }),
        }]}).encode()
        requisicao = urllib.request.Request(ALGOLIA_URL, data=corpo, headers=ALGOLIA_CABECALHOS)
        with urllib.request.urlopen(requisicao, timeout=20) as resposta:
            resultado = json.load(resposta)["results"][0]

        for produto in resultado["hits"]:
            nome = produto.get("fullname", "").lower()
            if not produto.get("has_stock") or any(t in nome for t in TRECHOS_NAO_JOGO):
                continue
            encontrados.append({
                "id": produto["objectID"],
                "link": f"https://www.instant-gaming.com/pt/{produto['objectID']}-comprar-{produto['seo_name']}/",
                "credito": bool(produto.get("is_prepaid") or produto.get("is_subscription")),
            })
        pagina += 1
        if pagina >= resultado.get("nbPages", 0):
            break
    return encontrados[:quantidade]


def carregar_env():
    """Lê chaves de um arquivo .env na raiz do repositório (ex: ITAD_API_KEY=abc123),
    pra não precisar digitar a chave toda vez que rodar no PC. O .env está no .gitignore,
    então nunca vai pro GitHub. Variável que já existe no ambiente (ex: o secret no
    GitHub Actions) tem prioridade sobre o arquivo."""
    arquivo = PASTA_SITE.parent.parent / ".env"
    if not arquivo.exists():
        return
    for linha in arquivo.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        nome, valor = linha.split("=", 1)
        os.environ.setdefault(nome.strip(), valor.strip().strip('"').strip("'"))


def itad_post(caminho, corpo, chave=None, **parametros):
    if chave:
        parametros["key"] = chave
    url = f"{ITAD_API}{caminho}?{urllib.parse.urlencode(parametros)}"
    # User-Agent próprio: o ITAD recusa (403) o "Python-urllib" padrão.
    requisicao = urllib.request.Request(url, data=json.dumps(corpo).encode(), headers={
        "Content-Type": "application/json",
        "User-Agent": "DiretoGamesBrasil-promocoes/1.0 (+https://ikozielski.github.io/diretogames/)",
    })
    with urllib.request.urlopen(requisicao, timeout=30) as resposta:
        return json.load(resposta)


def em_lotes(lista, tamanho):
    for i in range(0, len(lista), tamanho):
        yield lista[i:i + tamanho]


def marcar_menor_historico(promocoes, chave):
    """Liga 'menorHistorico' nos jogos de PC cujo preço na Instant Gaming é menor ou igual
    ao menor preço histórico nas lojas de ITAD_LOJAS. Não desliga o que você marcou à mão
    no links.txt. Devolve quantos jogos ganharam o selo."""
    jogos_pc = [p for p in promocoes if p["tipo"] == "jogo" and "PC" in p["categorias"]]
    titulos = sorted({p["jogo"] for p in jogos_pc})

    # 1. Nome do jogo -> id do ITAD (nome não encontrado volta None e fica sem selo).
    ids = {}
    for lote in em_lotes(titulos, 100):
        ids.update(itad_post("/lookup/id/title/v1", lote))

    # 2. id -> menor preço histórico em reais, considerando só as lojas escolhidas.
    menores = {}
    ids_encontrados = sorted({i for i in ids.values() if i})
    for lote in em_lotes(ids_encontrados, 100):
        resposta = itad_post("/games/storelow/v2", lote, chave, country="BR",
                             shops=",".join(str(loja) for loja in ITAD_LOJAS))
        for jogo in resposta:
            precos = [low["price"]["amount"] for low in jogo.get("lows", [])
                      if low["price"]["currency"] == "BRL"]
            if precos:
                menores[jogo["id"]] = min(precos)

    # 3. Compara. Jogo que não existe nessas lojas (sem histórico) fica sem selo.
    marcados = 0
    for promo in jogos_pc:
        menor_oficial = menores.get(ids.get(promo["jogo"]))
        if menor_oficial is not None and promo["precoPromo"] <= menor_oficial:
            if not promo.get("menorHistorico"):
                marcados += 1
            promo["menorHistorico"] = True
    print(f"ITAD: {len(menores)} de {len(titulos)} jogos de PC com histórico nas lojas oficiais;"
          f" {marcados} {'ganhou' if marcados == 1 else 'ganharam'} o selo MENOR HISTÓRICO")
    return marcados


def id_do_produto(link):
    """'https://www.instant-gaming.com/pt/12451-comprar-sea-of-stars/' -> '12451'"""
    m = re.search(r"instant-gaming\.com/[a-z]{2}/(\d+)-", link)
    return m.group(1) if m else None


def extrair_promocao(link, credito=False):
    pagina, link_final = baixar_pagina(link)
    titulo = achar(r'<meta property="og:title" content="([^"]*)"', pagina)
    imagem = achar(r'<meta property="og:image" content="([^"]*)"', pagina)
    disponibilidade = achar(r'itemprop="availability" content="([^"]*)"', pagina) or ""
    modelo = ler_product_model(pagina)

    if not titulo or not modelo or modelo.get("price") is None:
        raise ValueError("não achei nome/preço na página (o layout da Instant Gaming pode ter mudado)")
    # Garante que o preço veio em reais (com outro idioma/região poderia vir em euro).
    if "R$" not in html.unescape(modelo.get("retail_currency_format", "")):
        raise ValueError(f"preço não veio em reais: {modelo.get('retail_currency_format')}")

    preco_promo = float(modelo["price"])
    preco_cheio = float(modelo.get("retail") or preco_promo)

    # Junta o slug do link original (às vezes em inglês) e o final (em português) pra
    # reconhecer plataforma/gift card pelas palavras dos dois.
    slugs = " ".join(u.rstrip("/").rsplit("/", 1)[-1].lower() for u in (link, link_final))
    categorias = descobrir_categorias(f"{slugs} {titulo}")
    promo = {
        "jogo": limpar_nome(titulo),
        "plataforma": descobrir_plataforma(titulo, categorias),
        "categorias": categorias,
        "tipo": "giftcard" if credito or eh_gift_card(f"{slugs} {titulo.lower()}") else "jogo",
        "loja": "Instant Gaming",
        "precoOriginal": max(preco_cheio, preco_promo),
        "precoPromo": preco_promo,
        "imagem": imagem,
        "link": link_final.split("?")[0],
    }
    # schema.org: InStock = à venda, PreOrder = pré-venda (dá pra comprar), resto = esgotado
    if "PreOrder" in disponibilidade:
        promo["preVenda"] = True
    elif "InStock" not in disponibilidade:
        promo["esgotado"] = True
    return promo


def main():
    # Terminal do Windows às vezes não usa UTF-8 e embaralha os acentos das mensagens.
    sys.stdout.reconfigure(encoding="utf-8")

    if not ARQUIVO_LINKS.exists():
        sys.exit(f"Arquivo não encontrado: {ARQUIVO_LINKS}")

    # 1. Destaques do links.txt
    destaques = ler_linhas_do_txt()
    print(f"{len(destaques)} destaque(s) no links.txt")

    # 2. Mais vendidos (sem repetir o que já está nos destaques)
    mais_vendidos = []
    if QUANTIDADE_MAIS_VENDIDOS > 0:
        ids_destaques = {id_do_produto(link) for _, link, _ in destaques}
        try:
            # Pede 10% a mais: alguns saem por estar esgotados na página, e o corte pra
            # QUANTIDADE_MAIS_VENDIDOS exata acontece depois de baixar.
            extra = QUANTIDADE_MAIS_VENDIDOS // 10
            mais_vendidos = [p for p in buscar_mais_vendidos(QUANTIDADE_MAIS_VENDIDOS + extra + len(destaques))
                             if p["id"] not in ids_destaques][:QUANTIDADE_MAIS_VENDIDOS + extra]
            print(f"{len(mais_vendidos)} candidato(s) entre os mais vendidos da Instant Gaming")
        except Exception as erro:
            print(f"  ERRO ao buscar os mais vendidos (seguindo só com os destaques): {erro}")

    # Cada tarefa: (rótulo pras mensagens, link, opções do links.txt, é destaque?, é crédito?)
    tarefas = [(f"linha {n}", link, opcoes, True, False) for n, link, opcoes in destaques]
    tarefas += [(f"mais vendido #{i}", p["link"], [], False, p["credito"]) for i, p in enumerate(mais_vendidos, 1)]
    print(f"\nBaixando {len(tarefas)} página(s)...")

    # Erros contados à parte: "None" no resultado também pode ser um esgotado pulado.
    log_erros = []

    def processar(tarefa):
        rotulo, link, opcoes, destaque, credito = tarefa
        try:
            promo = extrair_promocao(link, credito)
            aplicar_opcoes(promo, opcoes, rotulo)
            if destaque:
                promo["destaque"] = True
            elif promo.get("esgotado"):
                return None  # mais vendido esgotado não vale o espaço (destaque esgotado fica, apagado)
            return promo
        except Exception as erro:
            print(f"  ERRO {rotulo}: {link}\n       {erro}")
            log_erros.append(rotulo)
            return None

    # executor.map devolve na mesma ordem das tarefas: destaques primeiro, depois os
    # mais vendidos em ordem de vendas — é essa a ordem "Em destaque" do site.
    with ThreadPoolExecutor(DOWNLOADS_SIMULTANEOS) as executor:
        resultados = list(executor.map(processar, tarefas))
    erros = len(log_erros)
    promocoes = [p for p in resultados if p and p.get("destaque")]
    promocoes += [p for p in resultados if p and not p.get("destaque")][:QUANTIDADE_MAIS_VENDIDOS]

    # Trava de segurança: se quase tudo deu erro (Instant Gaming fora do ar, bloqueio,
    # layout mudou), não sobrescreve o arquivo — melhor o site ficar com os preços de
    # ontem do que vazio.
    if not promocoes or erros > len(tarefas) / 2:
        sys.exit(f"\n{erros} de {len(tarefas)} deram erro — arquivo NÃO foi atualizado.")

    # Selo MENOR HISTÓRICO automático. Se o ITAD falhar, segue sem ele: os preços da
    # Instant Gaming são o principal e não podem deixar de atualizar por causa disso.
    carregar_env()
    chave_itad = os.environ.get("ITAD_API_KEY", "").strip()
    if chave_itad:
        try:
            marcar_menor_historico(promocoes, chave_itad)
        except Exception as erro:
            print(f"  ERRO no ITAD (seguindo sem o selo automático): {erro}")
    else:
        print("ITAD_API_KEY não definida: pulando o selo automático de MENOR HISTÓRICO")

    for promo in promocoes:
        if promo.get("destaque"):
            selo = " [ESGOTADO]" if promo.get("esgotado") else " [PRÉ-VENDA]" if promo.get("preVenda") else ""
            print(f"  ok  {promo['jogo']} — R$ {promo['precoPromo']:.2f} (de R$ {promo['precoOriginal']:.2f}){selo}")

    conteudo = (
        "// ARQUIVO GERADO AUTOMATICAMENTE por ferramentas/atualizar-promocoes.py (destaques do\n"
        "// links.txt + mais vendidos da Instant Gaming) — não edite aqui (as mudanças somem\n"
        "// na próxima atualização). Pra promoções de outras lojas, use js/promocoes-dados.js.\n"
        # Sem data de atualização aqui de propósito: com ela o arquivo mudaria todo dia e o
        # GitHub Actions faria commit mesmo sem nenhum preço novo.
        f"const PROMOCOES_INSTANT_GAMING = {json.dumps(promocoes, ensure_ascii=False, indent=2)};\n"
    )
    ARQUIVO_SAIDA.write_text(conteudo, encoding="utf-8")
    print(f"\n{len(promocoes)} promoção(ões) salvas em {ARQUIVO_SAIDA.relative_to(PASTA_SITE.parent)}"
          f" ({erros} erro(s))")


if __name__ == "__main__":
    main()
