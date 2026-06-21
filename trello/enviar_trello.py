import os
import requests
from dotenv import load_dotenv
from .cartao import ler_base_de_dados

load_dotenv()

TRELLO_KEY = os.getenv("TRELLO_API_KEY")
TRELLO_TOKEN = os.getenv("TRELLO_TOKEN")

MAPEAMENTO_GLOBAL_TRELLO = {
    "Célula 6 - MARCIELE": os.getenv("TRELLO_CELULA6_DZ"),
    "Célula 2 - JULLIE": os.getenv("TRELLO_CELULA2_DZ"),
    "Célula 5 - CRISTIANE": os.getenv("TRELLO_CELULA5_DZ"),
    "Célula 3 - BIANCA": os.getenv("TRELLO_CELULA3_DZ"),
    "NEW BV": os.getenv("TRELLO_NEWBV"),
    "BASCULANTE": os.getenv("TRELLO_BASCULANTE"),
    "Célula 1 - PIVOTANTE - ADRIANO": os.getenv("TRELLO_CELULA1_PIVOTANTE"),
    "Célula 2 - PIVOTANTE - CARLOS": os.getenv("TRELLO_CELULA2_PIVOTANTE"),
    "Célula 3 - PIVOTANTE - ROLF": os.getenv("TRELLO_CELULA3_PIVOTANTE")
}

def criar_cartao_trello(
        titulo: str,
        descricao: str,
        id_lista: str
):
    if not id_lista:
        print("⚠️ ERRO: O ID da lista do Trello está vazio.")
        return {
            "sucesso": False,
            "status-code": 400,
            "dados": "ID da lista do Trello inválido ou não configurado."
        }

    # 🌟 AQUI ESTÁ A URL CORRETA DA API:
    url = "https://api.trello.com/1/cards"
    
    parametros = {
        "key": TRELLO_KEY,
        "token": TRELLO_TOKEN,
        "idList": id_lista,
        "name": titulo,
        "desc": descricao
    }

    # Transmite os parâmetros na URL isolando contra bloqueios do CloudFront
    resposta = requests.post(url, params=parametros)

    if resposta.status_code != 200:
        print(f"❌ Erro na API do Trello! Código de Status: {resposta.status_code}")
        print(f"Resposta do Trello: {resposta.text}")
        return {
            "sucesso": False,
            "status-code": resposta.status_code,
            "dados": resposta.text
        }
    
    return {
        "sucesso": True,
        "status-code": resposta.status_code,
        "dados": resposta.json()
    }

def executar(codigo, op, qtd, linha_celula):
    conteudo_cartao = ler_base_de_dados(codigo=codigo, op=op, qtd=qtd)

    if not conteudo_cartao or isinstance(conteudo_cartao, list) or "erro" in conteudo_cartao:
        print("Erro ao ler o conteúdo do cartão.")
        return False

    titulo_cartao = f"{conteudo_cartao['titulo']}"
    
    id_lista = MAPEAMENTO_GLOBAL_TRELLO.get(linha_celula)

    if not id_lista:
        print(f"Erro: Nenhuma lista configurada no .env para a célula: {linha_celula}")
        return False

    resultado = criar_cartao_trello(titulo_cartao, conteudo_cartao["conteudo"], id_lista)
    return resultado.get('sucesso', False)
