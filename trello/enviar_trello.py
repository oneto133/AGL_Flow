import os
import requests
from dotenv import load_dotenv
from .cartao import ler_base_de_dados
import pandas as pd

load_dotenv()

TRELLO_KEY = os.getenv("TRELLO_API_KEY")
TRELLO_TOKEN = os.getenv("TRELLO_TOKEN")

config_linhas = r"dados\csv\config_linhas.csv"

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

    url = "https://api.trello.com/1/cards"
    
    parametros = {
        "key": TRELLO_KEY,
        "token": TRELLO_TOKEN,
        "idList": id_lista,
        "name": titulo,
        "desc": descricao
    }

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
    """
    executa o envio do cartão para o trello

    ao enviar o cartao pega o id do cartão gerado para adicionar uma cor de capa
    """
    conteudo_cartao = ler_base_de_dados(codigo=codigo, op=op, qtd=qtd)

    if not conteudo_cartao or isinstance(conteudo_cartao, list) or "erro" in conteudo_cartao:
        print("Erro ao ler o conteúdo do cartão.")
        return False

    titulo_cartao = f"{conteudo_cartao['titulo']}"

    df = pd.read_csv(config_linhas, encoding='utf-8')

    try:
        id_lista = df.loc[df['celula_linha'] == linha_celula, 'id_lista'].values[0]
        color = df.loc[df['celula_linha'] == linha_celula, 'cor_cartao'].values[0]

    except IndexError:
        id_lista = None
        color = None

    if not id_lista:
        print(f"Erro: Verifique a sua base de linhas: {linha_celula}")
        return False

    resultado = criar_cartao_trello(titulo_cartao, conteudo_cartao["conteudo"], id_lista)

    if resultado.get('sucesso', False):
        id_cartao_criado = resultado['dados'].get('id')

        atualizar_cor(id_cartao= id_cartao_criado, cor=color)

        return resultado.get('sucesso', False)


def atualizar_cor(id_cartao, cor):

    #aplicar cor ao cartão criado do trello

    url = f"https://api.trello.com/1/cards/{id_cartao}"

    payload_cor = {
        "cover": {
            "color": cor,
            "size": "normal",
            "brightness": "dark"
        }
    }

    resposta = requests.put(
        url,
        params={"key": TRELLO_KEY, "token": TRELLO_TOKEN},
        json=payload_cor
    )

    if resposta.status_code == 200:
        print(f"Cor aplicada com sucesso")

        return False

    print("erro ao aplicar cor " + resposta.text)
    return False
