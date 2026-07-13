from pydantic import BaseModel, Field
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

class InspecaoCreate(BaseModel):
    id: int | None = None    
    op: int | None = None
    usuario: str | None = None
    linha: str | None = None
    tipo_inspecao: str | None = None
    resultado: str | None = None
    destino: str | None = None
    quantidade_programada: int | None = None
    inspecao_completa: bool | None = None
    quantidade_nc: int | None = None
    codigo_item: int | None = None
    descricao_item: str | None = None
    sem_fim: str | None = None
    central: str | None = None
    inspecoes: int | None = None
    tensao: str | None = None
    
    codigo: int
    descricao: str
    quantidade: int
    
    data_hora_inicio_inspecao: datetime | str
    data_hora_fim_inspecao: datetime | str

    possui_op: bool
    qtd_etiquetas: int
    status: str
    conformidade: bool
    refugo: bool
    aprovado: bool
    itens_inspecionados: list["ItemInspecionado"] = Field(default_factory=list)
    refugos: list["RefugoInspecao"] = Field(default_factory=list)
    codigo_nc: str | None = None
    observacao: str | None = None


    
class ItemInspecionado(BaseModel):
    id: int
    id_inspecao: int
    codigo: int
    descricao: str
    campo: str | None = None
    data_hora: datetime | str | None = None

class RefugoInspecao(BaseModel):
    id: int
    id_inspecao: int
    codigo: int
    descricao: str
    campo: str | None = None
    quantidade: int
    codigo_nc: str
    observacao: str

class InspecaoResponse(BaseModel):
    op: int
    codigo: int
    descricao: str
    quantidade: int

    codigo_estator: int
    estator: str
    codigo_semfim:int
    sem_fim: str
    codigo_capacitor: int
    capacitor: str
    codigo_placa:int
    placa: str

    encoder: str

    codigo_tampa: int
    tampa: str
    
    modulo: str | None = None
    cilindro: str | None = None

    codigo_manual: int
    manual: str

    kit: str | None = None
    etiqueta_interna: str | None = None
    etiqueta_tampa: str | None = None
    etiqueta_externa: str | None = None

class InspecaoDados(BaseModel):
    id: int
    id_inspecao: int
    op: int
    codigo: int
    descricao: str
    quantidade_programada: int
    inspecao_completa: bool
    quantidade_nc: int
    codigo_nc: str
    observacao: str
    codigo_item: int
    descricao_item: str
    destino: str
    sem_fim: str
    central: str
    inspecoes: int
    tensao: str


try:
    InspecaoCreate.model_rebuild()
except AttributeError:
    InspecaoCreate.update_forward_refs(
        ItemInspecionado=ItemInspecionado,
        RefugoInspecao=RefugoInspecao,
    )
