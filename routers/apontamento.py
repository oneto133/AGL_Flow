from fastapi import FastAPI, HTTPException, APIRouter, status
from fastapi.requests import Request
from fastapi.responses import Response

from config.templates import templates
from services import registrar_apontamento, retornar_dados_apontamento
from schemas import RegistrarApontamento
from services.atualizar_base import atualizar_base_reposicao
router = APIRouter(
    tags=["Produção"]
)

@router.post("/api/registrar-apontamento", status_code=status.HTTP_201_CREATED)
async def registrar_apontamento_producao(payload: RegistrarApontamento):
    try:
        registrar_apontamento(payload)
        return {
            "status": "sucesso",
            "mensagem": "Apontamento registrado com sucesso!"
        }

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)) from e

@router.get("/api/registro-apontamento")
async def registro_apontamento(op: int):

    dados = retornar_dados_apontamento(op)
    return dados


@router.get("/modal-produto")
async def abrir_modal(request: Request):
    return templates.TemplateResponse(request, "modal-produto.html")


@router.get("/apontamento/manual")
async def apontamento_manual(request: Request):
    return templates.TemplateResponse(request, "apontamento/apontamento_manual.html")

@router.post("/api/atualizar-base-reposicao")
async def _atualizar_base_reposicao(codigo: int, descricao: str, ean: int):
    return await atualizar_base_reposicao(codigo, descricao, ean)
