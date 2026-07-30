
from datetime import datetime
import csv
import pandas as pd

from utils import _ler_csv, _proximo_id, _append_csv
from schemas import RegistrarApontamento
from config import CSV_DIR
from .trello_fila import processar_apontamento_trello


APONTAMENTO = CSV_DIR / "apontamento.csv"
SEQUENCIAMENTO = CSV_DIR / "sequenciamento.csv"


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
    if dados.manual:
        inserir_sequenciamento_manual(dados)
    processar_apontamento_trello(dados.op, dados.status)


def inserir_sequenciamento_manual(dados: RegistrarApontamento) -> None:
    """Registra a OP manual mantendo todas as colunas do sequenciamento."""
    df = _ler_csv(SEQUENCIAMENTO)
    if not df.empty and "op" in df.columns:
        mesma_op = df["op"].astype(str).str.strip() == str(dados.op).strip()
        mesma_linha = True if not dados.linha else df.get("linha", "").astype(str).str.strip() == str(dados.linha).strip()
        if (mesma_op & mesma_linha).any():
            return
    if SEQUENCIAMENTO.exists() and SEQUENCIAMENTO.stat().st_size:
        with SEQUENCIAMENTO.open("r", newline="", encoding="utf-8") as arquivo:
            campos = next(csv.reader(arquivo))
    else:
        campos = ["id", "op", "codigo_produto", "descricao_produto", "quantidade", "linha", "operador", "prioridade", "status", "origem", "id_cartao", "data_hora_sequenciamento", "data_hora_finalizacao", "observacao", "fila", "tempo_total_fila", "hora_inicio_fila", "previsao_entrada"]
    linha = {campo: "" for campo in campos}
    linha.update({"op": dados.op, "codigo_produto": dados.codigo, "descricao_produto": dados.descricao or "", "quantidade": dados.quantidade or "", "linha": dados.linha or "", "status": dados.status or "", "observacao": dados.observacao or ""})
    with SEQUENCIAMENTO.open("a", newline="", encoding="utf-8") as arquivo:
        csv.DictWriter(arquivo, fieldnames=campos).writerow(linha)

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

def producao_tempo_real():
    pass
    

if __name__ == "__main__":
    dados = RegistrarApontamento(
        op = 12345,
        codigo = 12345,
        quantidade = 1,
        status = "teste",
        observacao = "teste",
    )

    registrar_apontamento(dados)
