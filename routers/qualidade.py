from fastapi import APIRouter, File, UploadFile
from fastapi.requests import Request
from fastapi.responses import FileResponse

from config.templates import templates
from config import CSV_DIR

from schemas import RegistrarColeta
from services import (
    buscar_produtos,
    _registrar_contagem,
    contados_hoje,
    importar_base_xlsx,
    csv_para_xlsx,
    xlsx_para_csv,
    exportar_contagens_para_xlsx
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
        "erro": "Não foi possível registrar a coleta"
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


# =========================
# HISTÓRICO
# =========================

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
