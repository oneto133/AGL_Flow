import asyncio
from datetime import datetime
import pandas as pd
import requests
import csv
from config.paths import CSV_DIR, TRELLO_KEY, TRELLO_TOKEN
from utils import adicionar_horas_uteis, calcular_horas_uteis

LISTAS_FEITOS = [
    "6526bb4c2b984ff99ae15707", #BASCULANTES
    "67090b6470563e5a400fb2cc", #DESLIZANTES
    "6a3d61a7c7ef895b33597dbb", #USINAGEM
    "6787f9ecc03fde256fd24826", #NEW BV
]

URL_CARTAO = "https://api.trello.com/1/cards/{id_cartao}"
URL_BOARD_CARDS = "https://api.trello.com/1/boards/{id_board}/cards"
INTERVALO_VERIFICACAO = 55

def calcular_medias_por_linha(df):
    """
    """

    historico = df[
        (df["status"] == "Concluído") &
        (df["quantidade"] > 0) &
        (df["tempo_total_fila"] > 0)
    ].copy()

    historico["tempo_unitario"] = (
        historico["tempo_total_fila"] /
        historico["quantidade"]
    )

    medias = (
        historico
        .groupby("linha")["tempo_unitario"]
        .mean()
        .round(4)
        .to_dict()
    )

    return medias

def calcular_previsao_em_lote(df):
    agora = datetime.now()
    df["quantidade"] = pd.to_numeric(df["quantidade"], errors="coerce").fillna(0)

    df["fila"] = pd.to_numeric(df["fila"], errors="coerce")

    medias_por_linha = calcular_medias_por_linha(df)

    linhas_ativas = df[(df["status"] != "Concluído") & (df["fila"].notna())]

    for idx, row in linhas_ativas.iterrows():
        linha_producao = row["linha"]
        rank_atual = row["fila"]

        media_item_linha = medias_por_linha.get(linha_producao, 0.0833)

        ops_na_frente = df[
            (df["linha"] == linha_producao) &
            (df["status"] != "Concluído") &
            (df["fila"] < rank_atual)
        ]

        tempo_acumulado_espera = 0.0

        for _, op_frente in ops_na_frente.iterrows():
            qtd_frente = op_frente["quantidade"] if pd.notna(op_frente["quantidade"]) else 0
            tempo_previsto = qtd_frente * media_item_linha

            if op_frente["fila"] == 1:
                hora_inicio = pd.to_datetime(op_frente["hora_inicio_fila"], errors="coerce")

                if pd.notna(hora_inicio):
                    tempo_decorrido = calcular_horas_uteis(hora_inicio, agora)
                    tempo_restante = max(0, tempo_previsto - tempo_decorrido)

                else:
                    tempo_restante = tempo_previsto

                tempo_acumulado_espera += tempo_restante

            else:
                tempo_acumulado_espera += tempo_previsto

        data_previsao = adicionar_horas_uteis(agora, tempo_acumulado_espera)
        df.at[idx, "previsao_entrada"] = data_previsao.isoformat()


def consultar_cartao(id_cartao: str):

    try:
        resposta = requests.get(
            URL_CARTAO.format(id_cartao=id_cartao),
                params={"key": TRELLO_KEY,
                        "token": TRELLO_TOKEN,
                        "fields": "id,closed,idList,idBoard"
                        },
                        timeout=10
                )
        resposta.raise_for_status()
    
        return resposta.json()
    
    except requests.exceptions.RequestException as e:
        print(f"Erro ao consultar trello: {e}")
        return None

def obter_rank_cartao(
    id_cartao: str,
    id_lista: str,
    cartoes_board: list
) -> int | None:
    cartoes_ordenados = sorted(
        (
            c for c in cartoes_board
            if c["idList"] == id_lista and not c["closed"]
        ),
        key=lambda c: c["pos"]
    )

    for ranking, cartao in enumerate(cartoes_ordenados, start=1):
        if cartao["id"] == id_cartao:
            return ranking

    return None

def baixar_cartoes_board(id_board: str):
    try:
        resposta = requests.get(
            URL_BOARD_CARDS.format(id_board=id_board),
            params = {
                "key": TRELLO_KEY,
                "token": TRELLO_TOKEN,
                "fields": "id,idList,closed,pos"
            },
            timeout=10
        )

        resposta.raise_for_status()

        return resposta.json()

    except requests.exceptions.RequestException as e:
        print(f"Erro ao consultar Trello: {e}")
        return []

def atualizar_prioridade(id_cartao: str, ranking: int, df: pd.DataFrame):

    indice_cartao = df["id_cartao"] == id_cartao

    if not df[indice_cartao].empty and ranking is not None:
        df.loc[indice_cartao, "fila"] = int(ranking)

def atualizar_e_calcular_csv(id_cartao: str, df: pd.DataFrame, caminho: str = None):

    indice_cartao = df["id_cartao"] == id_cartao

    if not df[indice_cartao].empty:
        df.loc[indice_cartao, "status"] = "Concluído"
        agora_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        df.loc[indice_cartao, "data_hora_finalizacao"] = agora_str

        datas_finalizacao_dt = pd.to_datetime(df["data_hora_finalizacao"], errors="coerce")
        datas_sequenciamento_dt = pd.to_datetime(df["data_hora_sequenciamento"], errors="coerce")

        linha_atual = df.loc[indice_cartao, "linha"].values[0]
        
        fim_op_atual = datas_finalizacao_dt[indice_cartao].values[0]
        sequenciamento_atual = datas_sequenciamento_dt[indice_cartao].values[0]

        referencia_tempo = fim_op_atual if not pd.isna(fim_op_atual) else sequenciamento_atual

        historico_indices = (df["linha"] == linha_atual) & (df["status"] == "Concluído") & (datas_finalizacao_dt.notna())
        historico_anterior = datas_finalizacao_dt[historico_indices & (datas_finalizacao_dt < referencia_tempo)]

        if not historico_anterior.empty:
            hora_inicio_fila = historico_anterior.max()
            # Salva no DataFrame formatado como texto limpo
            df.loc[indice_cartao, "hora_inicio_fila"] = pd.Timestamp(hora_inicio_fila).strftime("%Y-%m-%d %H:%M:%S")
        else:
            hora_inicio_fila = None
            df.loc[indice_cartao, "hora_inicio_fila"] = None

        # 3. Calcula as horas úteis com os carimbos gerados
        inicio_ts = pd.to_datetime(hora_inicio_fila)
        fim_ts = pd.to_datetime(referencia_tempo)
        tempo_total_uteis = calcular_horas_uteis(inicio_ts, fim_ts)
        
        df.loc[indice_cartao, "tempo_total_fila"] = tempo_total_uteis
        df.loc[indice_cartao, "fila"] = None

        print(f"Cartão {id_cartao} atualizado e tempo de fila calculado: {tempo_total_uteis} h.")
    else:
        print(f"Aviso: Cartão {id_cartao} não localizado na planilha.")

def verificar_cartao(id_cartao: str, df: pd.DataFrame, boards_cache: dict):
    dados = consultar_cartao(id_cartao)

    if dados is None:
        return

    # Cartão concluído
    if dados["closed"] or dados["idList"] in LISTAS_FEITOS:
        atualizar_e_calcular_csv(id_cartao, df)
        return

    id_board = dados["idBoard"]

    if id_board not in boards_cache:
        boards_cache[id_board] = baixar_cartoes_board(id_board)

    ranking = obter_rank_cartao(
        id_cartao=id_cartao,
        id_lista=dados["idList"],
        cartoes_board=boards_cache[id_board]
    )

    if ranking is not None:
        atualizar_prioridade(id_cartao, ranking, df)

async def verificar_cartoes():
    while True:
        try:
            boards_cache = {}
            caminho = CSV_DIR / "sequenciamento.csv"
            df = pd.read_csv(caminho, encoding="utf-8", engine="python", quotechar='"')
            
            pendentes = df[df["status"] != "Concluído"]

            for _, linha in pendentes.iterrows():
                id_cartao = linha["id_cartao"]
                if pd.notna(id_cartao):
                    verificar_cartao(id_cartao, df, boards_cache)

            calcular_previsao_em_lote(df)

            df.to_csv(caminho, index=False, encoding="utf-8", sep=",", quotechar='"', quoting=csv.QUOTE_MINIMAL)

        except Exception as e:
            print(f"Erro no loop principal: {e}")

        await asyncio.sleep(INTERVALO_VERIFICACAO)


if __name__ == "__main__":
    asyncio.run(verificar_cartoes())