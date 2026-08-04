from fastapi import APIRouter
from fastapi.requests import Request
from config.templates import templates
from services import painel_resumo, painel_detalhe, eficiencia_historico, painel_exibicao

router = APIRouter(tags=["Painel de produção"])


@router.get("/painel-producao")
def painel_page(request: Request):
    return templates.TemplateResponse(request, "painel_producao.html")


@router.get("/painel-producao/eficiencia")
def eficiencia_page(request: Request):
    return templates.TemplateResponse(request, "eficiencia_linha.html")


@router.get("/painel-producao/exibicao")
def painel_exibicao_page(request: Request):
    return templates.TemplateResponse(request, "painel_exibicao.html")


@router.get("/api/painel-producao")
def painel_api():
    return painel_resumo()


@router.get("/api/painel-producao/linha/{linha:path}")
def painel_linha(linha: str):
    return painel_detalhe(linha)


@router.get("/api/painel-producao/eficiencia")
def painel_eficiencia(secao: str = "", linha: str = "", periodo: str = "total"):
    return eficiencia_historico(secao=secao, linha=linha, periodo=periodo)


@router.get("/api/painel-producao/exibicao")
def painel_exibicao_api():
    return painel_exibicao()
