from fastapi import APIRouter
from fastapi.requests import Request
from config.templates import templates

from schemas import DadosCartao
from trello import executar

router = APIRouter(
    tags=["Trello"]
)

@router.get("/cartao-trello")
def cartao_trello(request: Request):
    return templates.TemplateResponse(request, "trello.html")

@router.post("/api/enviar-para-trello")
def enviar_cartao_trello(dados: DadosCartao):

    enviar_trello = executar(dados.codigo, dados.op, dados.quantidade, dados.linhaCelula)

    if enviar_trello:
        return {"mensagem": "Cartão enviado para o Trello com sucesso."}

    return {'erro': 'Não foi possível enviar o cartão parao Trello'}