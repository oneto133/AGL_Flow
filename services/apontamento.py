
from datetime import datetime

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




if __name__ == "__main__":
    dados = RegistrarApontamento(
        op = 12345,
        codigo = 12345,
        quantidade = 1,
        status = "teste",
        observacao = "teste",
    )

    registrar_apontamento(dados)