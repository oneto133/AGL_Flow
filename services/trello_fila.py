from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd
import requests

from config.paths import CSV_DIR, TRELLO_KEY, TRELLO_TOKEN
from utils import _ler_csv, normalize_text

SEQUENCIAMENTO = CSV_DIR / "sequenciamento.csv"
CONFIG_LINHAS = CSV_DIR / "config_linhas.csv"
LISTAS = Path(__file__).resolve().parent.parent / "config" / "trello_listas.csv"
CARD_URL = "https://api.trello.com/1/cards/{id_card}"
BOARD_CARDS_URL = "https://api.trello.com/1/boards/{id_board}/cards"


def listar_ids_feitos() -> set[str]:
    df = _ler_csv(LISTAS)
    if df.empty or "id_lista_feitos" not in df.columns:
        return set()
    return {str(valor).strip() for valor in df["id_lista_feitos"] if str(valor).strip()}


def _lista_feitos_por_secao(secao: str) -> str:
    df = _ler_csv(LISTAS)
    if df.empty:
        return ""
    filtro = df.loc[df["secao"].astype(str).map(normalize_text) == normalize_text(secao)]
    return str(filtro.iloc[0]["id_lista_feitos"]).strip() if not filtro.empty else ""


def _credenciais_ok() -> bool:
    return bool(TRELLO_KEY and TRELLO_TOKEN)


def _buscar_card(id_card: str) -> dict[str, Any] | None:
    resposta = requests.get(CARD_URL.format(id_card=id_card), params={"key": TRELLO_KEY, "token": TRELLO_TOKEN, "fields": "id,idBoard,idList,closed"}, timeout=10)
    return resposta.json() if resposta.ok else None


def _mover_card(id_card: str, *, id_lista: str | None = None, pos: str | None = None) -> bool:
    params = {"key": TRELLO_KEY, "token": TRELLO_TOKEN}
    if id_lista:
        params["idList"] = id_lista
    if pos:
        params["pos"] = pos
    resposta = requests.put(CARD_URL.format(id_card=id_card), params=params, timeout=10)
    return resposta.ok


def _promover_primeiro(id_card: str, id_board: str, id_lista: str) -> bool:
    resposta = requests.get(BOARD_CARDS_URL.format(id_board=id_board), params={"key": TRELLO_KEY, "token": TRELLO_TOKEN, "fields": "id,idList,closed"}, timeout=10)
    if not resposta.ok:
        return False
    cards = [card for card in resposta.json() if card.get("idList") == id_lista and not card.get("closed")]
    if cards and cards[0].get("id") == id_card:
        return True
    return _mover_card(id_card, pos="top")


def processar_apontamento_trello(op: int | str, codigo: int | str, status: str | None) -> None:
    if not _credenciais_ok():
        return
    status_normalizado = normalize_text(status)
    if status_normalizado not in {"em processo", "finalizada", "finalizado", "concluido", "concluida"}:
        return
    seq = _ler_csv(SEQUENCIAMENTO)
    if seq.empty:
        return
    fila = seq.loc[(seq["op"].astype(str).str.strip() == str(op).strip()) & (seq["codigo_produto"].astype(str).str.strip() == str(codigo).strip())]
    if fila.empty:
        return
    registro = fila.iloc[-1]
    id_card = str(registro.get("id_cartao", "")).strip()
    if not id_card:
        return
    card = _buscar_card(id_card)
    if not card:
        return
    if status_normalizado in {"finalizada", "finalizado", "concluido", "concluida"}:
        config = _ler_csv(CONFIG_LINHAS)
        linha = str(registro.get("linha", "")).strip()
        secao = ""
        if not config.empty:
            filtro = config.loc[config["celula_linha"].astype(str).str.strip() == linha]
            if not filtro.empty:
                secao = str(filtro.iloc[0].get("secao", ""))
        destino = _lista_feitos_por_secao(secao)
        if destino:
            _mover_card(id_card, id_lista=destino, pos="top")
    elif card.get("idList"):
        _promover_primeiro(id_card, card.get("idBoard", ""), card["idList"])
