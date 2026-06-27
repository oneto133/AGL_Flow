from pydantic import BaseModel
from datetime import datetime


class SequenciarLinha(BaseModel):
    id: str | None = None

    op: int
    codigo_produto: int

    descricao_produto: str | None = None

    quantidade: str
    linha: str

    operador: str | None = None
    prioridade: str | None = None
    status: str | None = None
    origem: str | None = None

    id_cartao: str
    data_hora_sequenciamento: datetime

    data_hora_finalizacao: datetime | None = None
    observacao: str | None = None
