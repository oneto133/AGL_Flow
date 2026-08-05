import asyncio
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from fastapi.requests import Request
from fastapi.responses import FileResponse
from config.templates import templates
from schemas import CronoAnaliseCreate
from services import painel_resumo, painel_detalhe, eficiencia_historico, painel_exibicao, inserir_cronoanalise, listar_opcoes_cronoanalise, dados_impressao_basculante, gerar_planilha_impressao_basculante

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


@router.get("/painel-producao/cronoanalise")
def cronoanalise_page(request: Request):
    return templates.TemplateResponse(request, "cronoanalise.html")


@router.post("/api/painel-producao/cronoanalise", status_code=status.HTTP_201_CREATED)
async def inserir_cronoanalise_api(payload: CronoAnaliseCreate):
    try:
        registro = await asyncio.to_thread(inserir_cronoanalise, payload.model_dump())
        return {"status": "sucesso", "mensagem": "Crono-análise registrada com sucesso.", "registro": registro}
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Não foi possível registrar a crono-análise.") from exc


@router.get("/api/painel-producao/cronoanalise/opcoes")
async def opcoes_cronoanalise_api():
    return await asyncio.to_thread(listar_opcoes_cronoanalise)


@router.get("/painel-producao/impressao/basculante")
async def impressao_basculante_page(request: Request, op: str, codigo: str, linha: str = ""):
    dados = await asyncio.to_thread(dados_impressao_basculante, op, codigo, linha)
    if not dados:
        raise HTTPException(status_code=404, detail="Ordem não encontrada ou não pertence à seção Basculante.")
    return templates.TemplateResponse(request, "impressao_basculante.html", {"dados": dados, "op": op, "codigo": codigo, "linha": linha})


@router.get("/painel-producao/impressao/basculante/arquivo")
async def impressao_basculante_arquivo(background_tasks: BackgroundTasks, op: str, codigo: str, linha: str = ""):
    caminho = await asyncio.to_thread(gerar_planilha_impressao_basculante, op, codigo, linha)
    if not caminho:
        raise HTTPException(status_code=404, detail="Modelo ou ordem Basculante não encontrado.")
    if background_tasks is not None:
        background_tasks.add_task(Path(caminho).unlink, missing_ok=True)
    return FileResponse(caminho, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename=f"impressao_basculante_{op}.xlsx")


@router.get("/api/painel-producao")
async def painel_api():
    return await asyncio.to_thread(painel_resumo)


@router.get("/api/painel-producao/linha/{linha:path}")
async def painel_linha(linha: str, periodo: str = "dia"):
    return await asyncio.to_thread(painel_detalhe, linha, periodo)


@router.get("/api/painel-producao/eficiencia")
async def painel_eficiencia(secao: str = "", linha: str = "", periodo: str = "total"):
    return await asyncio.to_thread(eficiencia_historico, secao=secao, linha=linha, periodo=periodo)


@router.get("/api/painel-producao/exibicao")
async def painel_exibicao_api():
    return await asyncio.to_thread(painel_exibicao)
