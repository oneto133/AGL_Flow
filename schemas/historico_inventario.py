from pydantic import BaseModel, Field
from datetime import date, time

class HistoricoInventario(BaseModel):
    codigo: int
    descricao: str | None = None
    media: float | None = Field(default=None,
    description="Média de consumo calculada automática")

    sistema: int | None = Field(description="Saldo do sistema")
    galpao: int = Field(description="Quantidade contada")
    divergente: str | None = Field(default=None, description="subtrai o Galpão do sistema")
    porcentagem: str | None = Field(default=None, description="Calculado automáticamente para registro de média")
    data: date | None=None
    hora: time | None=None
    tipo: str
    observacao: str | None = None

class RegistrarContagem(BaseModel):
    codigo: int
    galpao: int = Field(description="Sistema só permite valores inteiros para inventário")
    tipo: str
    observacao: str = ""
