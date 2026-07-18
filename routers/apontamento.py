from fastapi import FastAPI, HTTPException, APIRouter
from fastapi.requests import Request
from fastapi.responses import Response
from config import templates

router = APIRouter(
    tags=["Produção"]
)

@router.get("/api/registrar-apontamento")
def registrar_apontamento(request: Request):
    pass