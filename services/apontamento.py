
from datetime import datetime
import pandas as pd

from utils import _ler_csv, _proximo_id, _append_csv
from schemas import RegistrarApontamento
from config import CSV_DIR


APONTAMENTO = CSV_DIR / "apontamento.csv"


def registrar_apontamento(dados: RegistrarApontamento):

    data_hora = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    df = _ler_csv(APONTAMENTO)
    proximo_id = _proximo_id(df)
    inserir = _append_csv(
        APONTAMENTO, {
            "id": proximo_id,
            "op": dados.op,
            "codigo": dados.codigo,
            "quantidade": dados.quantidade,
            "data_hora": data_hora,
            "status": dados.status,
            "observacao": dados.observacao,
        }
    )

def retornar_dados_apontamento(op):
    df = _ler_csv(APONTAMENTO)
    if df.empty:
        return {
            "quantidade_apontada": 0,
            "quantidade_ultimo_apontamento": 0,
            "ultima_data_hora": "Nenhum registro"
        }

    df["data_hora_dt"] = pd.to_datetime(df["data_hora"], format="%d/%m/%Y %H:%M:%S", errors="coerce")

    filtro = df[df["op"].astype(str) == str(op)]

    return {
        "quantidade_apontada": somar_quantidade_por_op(filtro),
        "quantidade_ultimo_apontamento": ultima_quantidade(filtro),
        "ultima_data_hora": ultima_data_hora(filtro)
    }

def somar_quantidade_por_op(filtro) -> int:
    if filtro.empty:
        return 0

    return int(filtro["quantidade"].sum())

def ultima_data_hora(filtro) -> str:

    if filtro.empty: return "Nenhum registro"

    maior_data = filtro["data_hora_dt"].max()

    if pd.isna(maior_data):
        return "Data inválida ou vazia"

    return maior_data.strftime("%d/%m/%Y %H:%M:%S")

def ultima_quantidade(filtro) -> int:
    if filtro.empty: return 0

    if filtro["data_hora_dt"].isna().all():
        return int(filtro["quantidade"].iloc[-1])

    ultima_qtd = filtro["data_hora_dt"].idxmax()

    return int(filtro.loc[ultima_qtd, "quantidade"])


if __name__ == "__main__":
    dados = RegistrarApontamento(
        op = 12345,
        codigo = 12345,
        quantidade = 1,
        status = "teste",
        observacao = "teste",
    )

    registrar_apontamento(dados)