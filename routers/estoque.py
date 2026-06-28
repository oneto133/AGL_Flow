from fastapi import APIRouter, HTTPException
from fastapi.requests import Request
from config.templates import templates

from schemas import RegistrarContagem
from services import registrar_contagem, buscar_estoque_sistema, buscar_descricao, buscar_media, itens_a_contar

router = APIRouter(
    tags=["Estoque"]
)

@router.get("/inventario")
def cartao_trello(request: Request):
    return templates.TemplateResponse(request, "inventario.html")

@router.get("/contar-itens")
def contar_itens(request: Request):
    return templates.TemplateResponse(request, "itens_a_contar.html")

@router.post("/api/registrar-contagem")
def registrar_contagem_sistema(dados: RegistrarContagem):
    """
    Registra a contagem nos sitema
    """
    registrar = registrar_contagem(dados.codigo, dados.galpao, dados.tipo, dados.observacao)

    if not registrar:
        raise HTTPException(
            status_code=500,
            detail="Não foi possível registrar a contagem"
        )

    return {"mensagem": "Contagem registrada com sucesso"}

@router.get("/api/buscar-dados")
def buscar_dados(codigo: int):
    """
    Busca descricao, média, estoque sistema e futuramente ultima contagem
    """

    try:
        media = buscar_media(codigo)
        sistema = buscar_estoque_sistema(codigo)
        descricao = buscar_descricao(codigo)

        return {"media": media,
                "sistema": sistema,
                "descricao": descricao}
    
    except Exception:

        raise HTTPException (
            status_code = 500,
            detail = "Erro ao buscar dados do item"
        )

@router.get("/api/itens-a-contar")
def itens_a_contar_rota():
    """
    Retorna lista de itens que precisam ser contados hoje
    com base na média de dias entre contagens.
    """
    try:
        dados = itens_a_contar()

        return dados

    except Exception as e:
        print(e)
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao gerar lista de contagem: {str(e)}"
        )
    
