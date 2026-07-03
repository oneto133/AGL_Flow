import asyncio
from datetime import datetime, timedelta
import pandas as pd
import requests
import numpy as np
import csv
from config.paths import CSV_DIR, TRELLO_KEY, TRELLO_TOKEN
from auxiliar.check_relatorio import main as checar_relatorio

LISTAS_FEITOS = [
    "6526bb4c2b984ff99ae15707", #BASCULANTES
    "67090b6470563e5a400fb2cc", #DESLIZANTES
    "6a3d61a7c7ef895b33597dbb", #USINAGEM
    "6787f9ecc03fde256fd24826", #NEW BV
]

URL_CARTAO = "https://api.trello.com/1/cards/{id_cartao}"
URL_BOARD_CARDS = "https://api.trello.com/1/boards/{id_board}/cards"
INTERVALO_VERIFICACAO = 30

def calcular_medias_por_linha(df):
    """
    Calcula o tempo médio por peça para cada linha de produção.
    Retorna um dicionário:
    {
        "Célula 1 - ADRIANO": 0.082,
        "Célula 2 - RODRIGO": 0.094,
        ...
    }
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
def proximo_horario_util(data):
    while True:
        w = data.weekday()

        # Segunda a quinta
        if w <= 3:
            if data.hour < 7:
                return data.replace(hour=7, minute=0, second=0, microsecond=0)

            if data.hour >= 17:
                data = (data + timedelta(days=1)).replace(
                    hour=7, minute=0, second=0, microsecond=0
                )
                continue

            return data

        # Sexta
        elif w == 4:
            if data.hour < 7:
                return data.replace(hour=7, minute=0, second=0, microsecond=0)

            if data.hour >= 16:
                data = (data + timedelta(days=3)).replace(
                    hour=7, minute=0, second=0, microsecond=0
                )
                continue

            return data

        # Sábado
        elif w == 5:
            data = (data + timedelta(days=2)).replace(
                hour=7, minute=0, second=0, microsecond=0
            )

        # Domingo
        else:
            data = (data + timedelta(days=1)).replace(
                hour=7, minute=0, second=0, microsecond=0
            )

def adicionar_horas_uteis(data_inicio, horas_para_adicionar):
    """
    Soma as horas necessárias avançando minuto a minuto, 
    respeitando o expediente comercial da empresa.
    """
    data_inicio = proximo_horario_util(data_inicio)

    if horas_para_adicionar <= 0:
        return data_inicio

    minutos_restantes = int(horas_para_adicionar * 60)
    data_atual = data_inicio

    while minutos_restantes > 0:
        data_atual += timedelta(minutes=1)
        w = data_atual.weekday()  # 0=Segunda, 3=Quinta, 4=Sexta, 5=Sábado, 6=Domingo
        h = data_atual.hour

        # Verifica se o minuto atual está dentro do horário útil comercial
        if 0 <= w <= 3:  # Segunda a Quinta
            if 7 <= h < 17:
                minutos_restantes -= 1
        elif w == 4:     # Sexta
            if 7 <= h < 16:
                minutos_restantes -= 1
        # Sábados e Domingos são ignorados (o relógio corre sem descontar os minutos restantes)

    return data_atual

def calcular_previsao_em_lote():
    caminho = CSV_DIR / "sequenciamento.csv"
    agora = datetime.now()

    df = pd.read_csv(caminho, encoding="utf-8", engine="python", quotechar='"')
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

            # Tempo previsto para concluir a OP
            tempo_previsto = qtd_frente * media_item_linha

            # Se é a OP atualmente em produção (fila 1)
            if op_frente["fila"] == 1:

                hora_inicio = pd.to_datetime(op_frente["hora_inicio_fila"], errors="coerce")

                if pd.notna(hora_inicio):
                    tempo_decorrido = calcular_horas_uteis(hora_inicio, agora)
                    tempo_restante = max(0, tempo_previsto - tempo_decorrido)
                else:
                    # Caso não exista hora de início, considera o tempo completo
                    tempo_restante = tempo_previsto

                tempo_acumulado_espera += tempo_restante

            else:
                # Para as demais filas soma o tempo inteiro
                tempo_acumulado_espera += tempo_previsto

        data_previsao = adicionar_horas_uteis(agora, tempo_acumulado_espera)
        
        # Salva formatado como uma data legível no CSV
        df.at[idx, "previsao_entrada"] = data_previsao.isoformat()

    df.to_csv(caminho, index=False, encoding="utf-8", sep=",", quotechar='"', quoting=csv.QUOTE_MINIMAL)



def calcular_horas_uteis(inicio, fim):
    if pd.isna(inicio) or pd.isna(fim) or inicio >= fim:
        return 0.0
    minutos = pd.date_range(start=inicio, end=fim, freq='min')
    dias_semana = minutos.dayofweek
    horas = minutos.hour
    seg_qui_util = (dias_semana >= 0) & (dias_semana <= 3) & (horas >= 7) & (horas < 17)
    sexta_util = (dias_semana == 4) & (horas >= 7) & (horas < 16)
    minutos_uteis = np.sum(seg_qui_util | sexta_util)
    return round(minutos_uteis / 60.0, 2)

def consultar_cartao(id_cartao: str):
    resposta = requests.get(
        URL_CARTAO.format(id_cartao=id_cartao),
        params={"key": TRELLO_KEY, "token": TRELLO_TOKEN,
                "fields": "id,closed,idList,idBoard"}
    )
    if resposta.status_code != 200:
        print(f"Erro ao consultar cartão {id_cartao}: {resposta.status_code}")
        return None
    return resposta.json()

def obter_rank_cartao(id_cartao: str, id_lista: str, id_board: str):
    resposta = requests.get(
        URL_BOARD_CARDS.format(id_board=id_board),
        params={"key": TRELLO_KEY, "token": TRELLO_TOKEN, "fields": "id,idList,closed,pos"}
    )

    if resposta.status_code != 200:
        return None

    todos_os_cartoes = resposta.json()
    cartoes_da_lista = [c for c in todos_os_cartoes if c["idList"] == id_lista and not c["closed"]]
    cartoes_ordenados = sorted(cartoes_da_lista, key=lambda x: x["pos"]) 

    try:
        ranking = [c["id"] for c in cartoes_ordenados].index(id_cartao) + 1
        return ranking

    except ValueError:
        return None

def atualizar_prioridade(id_cartao: str, ranking: int):
    caminho = CSV_DIR / "sequenciamento.csv"

    df = pd.read_csv(caminho, encoding="utf-8", engine="python", quotechar='"')

    indice_cartao = df["id_cartao"] == id_cartao
    if not df[indice_cartao].empty and ranking is not None:
        df.loc[indice_cartao, "fila"] = int(ranking)

        df.to_csv(caminho, index=False, encoding="utf-8", sep=",", quotechar='"', quoting=csv.QUOTE_MINIMAL)

def atualizar_e_calcular_csv(id_cartao: str):
    caminho = CSV_DIR / "sequenciamento.csv"
    df = pd.read_csv(caminho, encoding="utf-8", engine="python", quotechar='"')

    indice_cartao = df["id_cartao"] == id_cartao
    if not df[indice_cartao].empty:
        # 1. Atualiza Status e Data Final no formato de texto padrão
        df.loc[indice_cartao, "status"] = "Concluído"
        agora_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        df.loc[indice_cartao, "data_hora_finalizacao"] = agora_str

        datas_finalizacao_dt = pd.to_datetime(df["data_hora_finalizacao"], errors="coerce")
        datas_sequenciamento_dt = pd.to_datetime(df["data_hora_sequenciamento"], errors="coerce")

        linha_atual = df.loc[indice_cartao, "linha"].values[0]
        
        # Extrai os timestamps da OP de forma limpa usando as séries na memória
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

        # 4. Salva de volta no CSV mantendo o texto original de todas as outras linhas
        df.to_csv(caminho, index=False, encoding="utf-8", sep=",", quotechar='"', quoting=csv.QUOTE_MINIMAL)
        print(f"Cartão {id_cartao} atualizado e tempo de fila calculado: {tempo_total_uteis} h.")
    else:
        print(f"Aviso: Cartão {id_cartao} não localizado na planilha.")

def verificar_cartao(id_cartao: str):
    dados = consultar_cartao(id_cartao)
    if dados is None:
        return

    if dados["closed"] or dados["idList"] in LISTAS_FEITOS:
        atualizar_e_calcular_csv(id_cartao)

    else:
        ranking = obter_rank_cartao(id_cartao, dados["idList"], dados["idBoard"])
        if ranking:
            atualizar_prioridade(id_cartao, ranking)
    



async def verificar_cartoes():
    while True:
        caminho = CSV_DIR / "sequenciamento.csv"
        df = pd.read_csv(caminho, encoding="utf-8", engine="python", quotechar='"')
        
        pendentes = df[df["status"] != "Concluído"]

        for _, linha in pendentes.iterrows():
            id_cartao = linha["id_cartao"]
            if pd.notna(id_cartao):
                verificar_cartao(id_cartao)

        calcular_previsao_em_lote()
        await asyncio.sleep(INTERVALO_VERIFICACAO)

if __name__ == "__main__":
    asyncio.run(verificar_cartoes())