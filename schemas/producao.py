from pydantic import BaseModel
from datetime import datetime

class RegistrarApontamento(BaseModel):
    id: int | None = None
    
    op: int
    codigo: int#Vai pedir codigo apenas caso alguém altere o codigo do produto da OP

    quantidade: int | None = None
    data_hora: datetime | str | None = None
    status: str | None = None
    observacao: str | None = None
