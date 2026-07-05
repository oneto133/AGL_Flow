from pydantic import BaseModel
from datetime import datetime

class ItensBase(BaseModel):
    codigo: int
    descricao: str | None = None


class RegistrarColeta(BaseModel):
    codigo: int

    descricao: str | None = None

    quantidade: int
    local: str
    
    data_hora: datetime | None = None
    responsavel: str | None = None
    observacao: str | None = None

