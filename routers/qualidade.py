from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.requests import Request
from fastapi.responses import FileResponse
from urllib.parse import quote

from config.templates import templates
from config import CSV_DIR

from schemas import RegistrarColeta, InspecaoCreate
from services import (
    buscar_produtos,
    _registrar_contagem,
    contados_hoje,
    importar_base_xlsx,
    csv_para_xlsx,
    xlsx_para_csv,
)

from utils import exportar_contagens_para_xlsx

from services.qualidade_inspecoes import (
    listar_secoes_inspecao,
    listar_linhas_por_secao,
    listar_ops_por_linha,
    buscar_op_inspecao,
    buscar_produto_inspecao,
    adicionar_item_base_qualidade,
    listar_inspecoes_do_dia,
    buscar_inspecao_dados_por_id,
    salvar_inspecao,
)

router = APIRouter(tags=["Qualidade"])


@router.get("/qualidade")
def qualidade(request: Request):
    return templates.TemplateResponse(request, "qualidade.html")


@router.post("/api/registrar-coleta")
def registrar_coleta(dados: RegistrarColeta):

    sucesso = _registrar_contagem(dados)

    if sucesso:
        return {
            "status_code": 200,
            "mensagem": "Coleta registrada com sucesso!"
        }

    return {
        "erro": "NÃ£o foi possÃ­vel registrar a coleta"
    }


@router.get("/api/buscar-produtos")
def _buscar_produtos():
    return buscar_produtos()


@router.get("/api/contados-hoje")
def _contados_hoje():
    return contados_hoje()


# =========================
# BASE ITENS REFUGO
# =========================

@router.get("/base/download")
def download_base():

    caminho_base = CSV_DIR / "base_itens_refugo.csv"
    caminho_saida = CSV_DIR / "base_itens_refugo.xlsx"

    csv_para_xlsx(
        str(caminho_base),
        str(caminho_saida)
    )

    return FileResponse(
        path=caminho_saida,
        filename="base_itens_refugo.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


@router.post("/base/upload")
async def upload_base(file: UploadFile = File(...)):

    caminho_base = CSV_DIR / "base_itens_refugo.csv"
    caminho_temp = CSV_DIR / f"upload_{file.filename}"

    with open(caminho_temp, "wb") as f:
        f.write(await file.read())

    xlsx_para_csv(
        str(caminho_temp),
        str(caminho_base)
    )

    return {
        "status": "ok",
        "message": "Base atualizada com sucesso"
    }


@router.post("/base/qualidade/upload")
async def upload_base_qualidade(file: UploadFile = File(...)):

    caminho_base = CSV_DIR / "base_qualidade.csv"
    caminho_temp = CSV_DIR / f"upload_{file.filename}"

    with open(caminho_temp, "wb") as f:
        f.write(await file.read())

    xlsx_para_csv(
        str(caminho_temp),
        str(caminho_base)
    )

    return {
        "status": "ok",
        "message": "Base de qualidade atualizada com sucesso"
    }

@router.get("/historico/download")
def download_historico():

    caminho = CSV_DIR / "registro_refugos.csv"
    caminho_saida = CSV_DIR / "registro_refugos.xlsx"

    exportar_contagens_para_xlsx(
        str(caminho),
        str(caminho_saida)
    )

    return FileResponse(
        path=caminho_saida,
        filename="registro_refugos.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

@router.get("/inspecoes/download")
def download_inspecoes():
    caminho = CSV_DIR / "inspecoes.csv"
    caminho_saida = CSV_DIR / "inspecoes.xlsx"

    exportar_contagens_para_xlsx(
        str(caminho),
        str(caminho_saida)
    )

    return FileResponse(
        path=caminho_saida,
        filename="inspecoes.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheettml.sheet"
    )

@router.get("/base/inspecoes-deslizantes")
def donwload_base_deslizante():
    caminho = CSV_DIR / "base_qualidade.csv"
    caminho_saida = CSV_DIR / "base_qualidade.xlsx"

    exportar_contagens_para_xlsx(
        str(caminho),
        str(caminho_saida)
    )

    return FileResponse(
        path=caminho_saida,
        filename="base_qualidade.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheettml.sheet"
    )

@router.get("/qualidade/inspecoes")
def qualidade_inspecoes(request: Request):
    return templates.TemplateResponse(request, "qualidade_inspecoes.html")


@router.get("/qualidade/inspecoes/linha/manual")
def qualidade_inspecao_manual(request: Request):
    linha = request.query_params.get("linha", "").strip()
    url_voltar = f"/qualidade/inspecoes/linha/{quote(linha)}" if linha else "/qualidade/inspecoes"
    return templates.TemplateResponse(
        request,
        "qualidade_inspecao_manual.html",
        {
            "linha": linha,
            "url_voltar": url_voltar,
        },
    )


@router.get("/qualidade/inspecoes/linha/{celula_linha:path}")
def qualidade_inspecao_linha(request: Request, celula_linha: str):
    return templates.TemplateResponse(
        request,
        "qualidade_inspecao_linha.html",
        {
            "celula_linha": celula_linha,
        },
    )


@router.get("/qualidade/inspecoes/dia")
def qualidade_inspecoes_dia(request: Request):
    return templates.TemplateResponse(
        request,
        "qualidade_inspecoes_dia.html",
        {},
    )


@router.get("/qualidade/inspecoes/op/{op}")
def qualidade_inspecao_op(request: Request, op: int):
    return templates.TemplateResponse(
        request,
        "qualidade_inspecao_op.html",
        {
            "op": op,
        },
    )


@router.get("/api/qualidade/inspecoes/secoes")
def api_qualidade_inspecoes_secoes():
    return listar_secoes_inspecao()


@router.get("/api/qualidade/inspecoes/linha/{celula_linha:path}")
def api_qualidade_inspecoes_linha(celula_linha: str):
    return listar_ops_por_linha(celula_linha)


@router.get("/api/qualidade/inspecoes/op/{op}")
def api_qualidade_inspecoes_op(op: int):
    return buscar_op_inspecao(op)


@router.get("/api/qualidade/inspecoes/produto/{codigo}")
def api_qualidade_inspecoes_produto(codigo: int):
    return buscar_produto_inspecao(codigo)


@router.get("/api/qualidade/inspecoes/dados/{id_inspecao}")
def api_qualidade_inspecoes_dados(id_inspecao: int):
    return buscar_inspecao_dados_por_id(id_inspecao)


@router.get("/api/qualidade/inspecoes/hoje")
def api_qualidade_inspecoes_hoje():
    return listar_inspecoes_do_dia()


@router.post("/api/qualidade/inspecoes/base-item")
def api_qualidade_inspecoes_base_item(payload: dict):
    codigo = payload.get("codigo")
    descricao_item = payload.get("descricao_item", "")
    return adicionar_item_base_qualidade(codigo, descricao_item)


@router.post("/api/qualidade/inspecoes/salvar")
async def api_qualidade_inspecoes_salvar(dados: InspecaoCreate):
    try:
        return await salvar_inspecao(dados)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc







