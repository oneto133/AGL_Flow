import asyncio
from datetime import datetime
import pandas as pd
import requests
from config.paths import CSV_DIR, TRELLO_KEY, TRELLO_TOKEN
from auxiliar.check_relatorio import main as checar_relatorio

"""
Verifica se um cartão foi movido para a coluna feito, caso tenha sido,
marca na base de dados como concluído e insere data e hora
Verificar apenas cartões que não foram movidos para feito ou arquivados

"""

LISTAS_FEITOS = [
    "6526bb4c2b984ff99ae15707", #BASCULANTES
    "67090b6470563e5a400fb2cc",  #DESLIZANTES
    "6a3d61a7c7ef895b33597dbb",  #USINAGEM
    "6787f9ecc03fde256fd24826",  #NEW BV
]

URL_CARTAO = "https://api.trello.com/1/cards/{id_cartao}"

INTERVALO_VERIFICACAO = 30

def consultar_cartao(id_cartao: str):

    resposta = requests.get(
        URL_CARTAO.format(id_cartao=id_cartao),
        params={
            "key": TRELLO_KEY,
            "token": TRELLO_TOKEN
        }
    )

    if resposta.status_code != 200:
        print(f"Erro ao consultar cartão {id_cartao}")
        print(resposta.status_code)
        return None

    return resposta.json()

def atualizar_csv(id_cartao: str):

    caminho = CSV_DIR / "sequenciamento.csv"

    df = pd.read_csv(caminho, encoding="utf-8")

    indice = df["id_cartao"] == id_cartao

    df.loc[indice, "status"] = "Concluído"

    df.loc[
        indice,
        "data_hora_finalizacao"
    ] = datetime.now().isoformat()
    df.to_csv(
        caminho,
        index=False,
        encoding="utf-8"
    )

    print(f"Cartão {id_cartao} atualizado.")

def verificar_cartao(id_cartao: str):

    dados = consultar_cartao(id_cartao)

    if dados is None:
        return

    if dados["closed"]:
        atualizar_csv(id_cartao)
        return

    if dados["idList"] in LISTAS_FEITOS:
        atualizar_csv(id_cartao)

async def verificar_cartoes():

    while True:

        caminho = CSV_DIR / "sequenciamento.csv"

        df = pd.read_csv(caminho, encoding="utf-8")

        pendentes = df[
            df["status"] != "Concluído"
        ]

        for _, linha in pendentes.iterrows():

            id_cartao = linha["id_cartao"]

            if pd.notna(id_cartao):

                verificar_cartao(id_cartao)


        await asyncio.sleep(INTERVALO_VERIFICACAO)

if __name__ == "__main__":
    asyncio.run(verificar_cartoes())