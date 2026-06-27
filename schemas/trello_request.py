from pydantic import BaseModel

class DadosCartao(BaseModel):
    codigo: str
    quantidade: str
    op: str
    linhaCelula: str
    posicao: str