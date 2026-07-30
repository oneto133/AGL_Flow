import asyncio
from datetime import datetime
import pandas as pd
import requests
import csv
from config.paths import CSV_DIR, TRELLO_KEY, TRELLO_TOKEN
from utils import adicionar_horas_uteis, calcular_horas_uteis
from .trello_fila import listar_ids_feitos

LISTAS_FEITOS = listar_ids_feitos()

URL_CARTAO = "https://api.trello.com/1/cards/{id_cartao}"
URL_BOARD_CARDS = "https://api.trello.com/1/boards/{id_board}/cards"
INTERVALO_VERIFICACAO = 55
COLUNAS_TEXTO = [
    "id",
    "status",
    "origem",
    "id_cartao",
    "data_hora_sequenciamento",
    "data_hora_finalizacao",
    "observacao",
    "hora_inicio_fila",
    "previsao_entrada",
    "descricao_produto",
    "linha",
    "operador",
    "prioridade",
]


def carregar_sequenciamento():
    caminho = CSV_DIR / "sequenciamento.csv"
    return pd.read_csv(
        caminho,
        encoding="utf-8",
        engine="python",
        dtype={coluna: "string" for coluna in COLUNAS_TEXTO},
    )

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

def calcular_ultima_finalizada(df):
    ultima = (df[(df["status"].fillna("") == "Concluído")][["linha", "data_hora_finalizacao"]].dropna())
    
    #pega ultima data
    dic = ultima.groupby("linha")["data_hora_finalizacao"].max()
    return dic


def inserir_data_inicio(df):
    dicionario = calcular_ultima_finalizada(df)

    if "hora_inicio_fila" in df.columns:
        df["hora_inicio_fila"] = df["hora_inicio_fila"].astype("string")

    condicao = (df["status"].fillna("") != "Concluído") & (df["fila"] == 1)

    fila_1 = (df[(df["status"] != "Concluído") & (df["fila"] == 1)][["linha", "hora_inicio_fila"]])
    
    df.loc[condicao, "hora_inicio_fila"] = df.loc[condicao, "linha"].map(dicionario).astype("string")

    caminho = CSV_DIR / "sequenciamento.csv"
    df.to_csv(caminho, index=False, encoding="utf-8", sep=",", quotechar='"', quoting=csv.QUOTE_MINIMAL)



def calcular_previsao_em_lote(df):
    # Removido o 'agora = datetime.now()' do topo, pois nÃ£o iniciaremos os cÃ¡lculos por ele
    df["quantidade"] = pd.to_numeric(df["quantidade"], errors="coerce").fillna(0)
    df["fila"] = pd.to_numeric(df["fila"], errors="coerce")

    medias_por_linha = calcular_medias_por_linha(df)
    linhas_ativas = df[(df["status"].fillna("") != "Concluído") & (df["fila"].notna())]

    for idx, row in linhas_ativas.iterrows():
        linha_producao = row["linha"]
        rank_atual = row["fila"]
        media_item_linha = medias_por_linha.get(linha_producao, 0.0833)

        # CENÃRIO 1: Se o item Ã© o nÃºmero 1 da fila, a previsÃ£o de entrada dele NÃƒO MUDA.
        # Ela Ã© exatamente a hora em que ele entrou na fila.
        if rank_atual == 1:
            hora_inicio_f1 = row["hora_inicio_fila"]
            if pd.notna(hora_inicio_f1):
                df.at[idx, "previsao_entrada"] = hora_inicio_f1
            else:
                df.at[idx, "previsao_entrada"] = pd.NA
            continue  # Pula para o próximo item da fila
            continue  # Pula para o prÃ³ximo item da fila

        # CENÃRIO 2: Se o item estÃ¡ na posiÃ§Ã£o 2, 3, etc., calculamos com base no Fila 1 fixo
        ops_na_frente = df[
            (df["linha"] == 1) | # Ajuste conceitual: buscamos quem estÃ¡ na frente nesta linha de produÃ§Ã£o
            ((df["linha"] == linha_producao) & (df["status"].fillna("") != "Concluído") & (df["fila"] < rank_atual))
        ]

        tempo_acumulado_espera = 0.0
        ponto_de_partida_tempo = None

        for _, op_frente in ops_na_frente.iterrows():
            qtd_frente = op_frente["quantidade"] if pd.notna(op_frente["quantidade"]) else 0
            tempo_previsto = qtd_frente * media_item_linha

            if op_frente["fila"] == 1:
                hora_inicio = pd.to_datetime(op_frente["hora_inicio_fila"], errors="coerce")
                
                if pd.notna(hora_inicio):
                    # O tempo acumulado comeÃ§a a contar a partir da hora de inÃ­cio real do Fila 1
                    ponto_de_partida_tempo = hora_inicio
                    tempo_acumulado_espera += tempo_previsto
                else:
                    ponto_de_partida_tempo = datetime.now()
                    tempo_acumulado_espera += tempo_previsto
            else:
                tempo_acumulado_espera += tempo_previsto

        # Se nÃ£o encontrou nenhum Fila 1 para usar de base, usa o horÃ¡rio de agora
        if ponto_de_partida_tempo is None:
            ponto_de_partida_tempo = datetime.now()

        # Calcula a previsÃ£o somando o tempo acumulado a partir da hora estÃ¡vel de inÃ­cio do Fila 1
        data_previsao = adicionar_horas_uteis(ponto_de_partida_tempo, tempo_acumulado_espera)
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

async def consultar_cartao_async(id_cartao: str):
    return await asyncio.to_thread(consultar_cartao, id_cartao)

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

async def baixar_cartoes_board_async(id_board: str):
    return await asyncio.to_thread(baixar_cartoes_board, id_board)
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

        historico_indices = (df["linha"] == linha_atual) & (df["status"].fillna("") == "Concluído") & (datas_finalizacao_dt.notna())
        historico_anterior = datas_finalizacao_dt[historico_indices & (datas_finalizacao_dt < referencia_tempo)]

        if not historico_anterior.empty:
            hora_inicio_fila = historico_anterior.max()
            # Salva no DataFrame formatado como texto limpo
            df.loc[indice_cartao, "hora_inicio_fila"] = pd.Timestamp(hora_inicio_fila).strftime("%Y-%m-%d %H:%M:%S")
        else:
            hora_inicio_fila = None
            df.loc[indice_cartao, "hora_inicio_fila"] = None

        inicio_ts = pd.to_datetime(hora_inicio_fila)
        fim_ts = pd.to_datetime(referencia_tempo)
        tempo_total_uteis = calcular_horas_uteis(inicio_ts, fim_ts)
        
        df.loc[indice_cartao, "tempo_total_fila"] = tempo_total_uteis
        df.loc[indice_cartao, "fila"] = None

    else:
        pass

async def verificar_cartao(
    id_cartao: str,
    df: pd.DataFrame,
    boards_cache: dict,
    cache_lock: asyncio.Lock,
):
    dados = await consultar_cartao_async(id_cartao)

    if dados is None:
        return

    # CartÃ£o concluÃ­do
    if dados["closed"] or dados["idList"] in LISTAS_FEITOS:
        atualizar_e_calcular_csv(id_cartao, df)
        return

    id_board = dados["idBoard"]

    if id_board not in boards_cache:
        async with cache_lock:
            if id_board not in boards_cache:
                boards_cache[id_board] = await baixar_cartoes_board_async(id_board)

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
            cache_lock = asyncio.Lock()
            caminho = CSV_DIR / "sequenciamento.csv"
            df = carregar_sequenciamento()
            
            pendentes = df[df["status"].fillna("") != "Concluído"]

            tarefas = []
            for _, linha in pendentes.iterrows():
                id_cartao = linha["id_cartao"]
                if pd.notna(id_cartao):
                    tarefas.append(
                        verificar_cartao(id_cartao, df, boards_cache, cache_lock)
                    )

            if tarefas:
                await asyncio.gather(*tarefas)

            inserir_data_inicio(df)
            calcular_previsao_em_lote(df)

            df.to_csv(caminho, index=False, encoding="utf-8", sep=",", quotechar='"', quoting=csv.QUOTE_MINIMAL)

        except Exception as e:
            print(f"Erro no loop principal: {e}")

        await asyncio.sleep(INTERVALO_VERIFICACAO)


if __name__ == "__main__":
    """caminho = CSV_DIR / "sequenciamento.csv"
    df = pd.read_csv(caminho, encoding="utf-8", engine="python", quotechar='"')
    #calcular_ultima_finalizada(df)
    inserir_data_inicio(df)"""
    asyncio.run(verificar_cartoes())








