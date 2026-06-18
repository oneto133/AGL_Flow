import json
import os
import threading
import time
import webbrowser
from pathlib import Path
from typing import Any
from urllib import error, request
from urllib.parse import urlparse

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field


DEFAULT_REMOTE_API_URL = os.getenv("REMOTE_API_URL", "http://192.168.1.67")
DEFAULT_NETWORK_HOST = os.getenv("NETWORK_API_HOST", "0.0.0.0")
DEFAULT_NETWORK_PORT = int(os.getenv("NETWORK_API_PORT", "8001"))
REMOTE_API_PORTS = tuple(
    int(port.strip())
    for port in os.getenv("REMOTE_API_PORTS", "8000,8001,8002").split(",")
    if port.strip().isdigit()
)
if not REMOTE_API_PORTS:
    REMOTE_API_PORTS = (8000, 8001, 8002)
REMOTE_ACCESS_ERROR = "Sem acesso ao servidor."


app = FastAPI(title="API de rede para etiquetas")
RESOURCE_DIR = Path(__file__).resolve().parent
style_dir = RESOURCE_DIR / "style"
images_dir = RESOURCE_DIR / "imagens"
if style_dir.is_dir():
    app.mount("/style", StaticFiles(directory=style_dir), name="style")
if images_dir.is_dir():
    app.mount("/imagens", StaticFiles(directory=images_dir), name="imagens")
templates = Jinja2Templates(directory=RESOURCE_DIR / "templates")


class PrintRequest(BaseModel):
    etiqueta: str = Field(min_length=1)
    quantidade: int = Field(ge=1, le=500)


class RemoteTargetRequest(BaseModel):
    target_url: str | None = None


def _normalize_url(url: str | None) -> str:
    return (url or "").strip().rstrip("/")


def _is_loopback_url(url: str) -> bool:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    return host in {"127.0.0.1", "localhost", "::1"}


def _ensure_scheme(url: str) -> str:
    if "://" in url:
        return url
    return f"http://{url}"


def _candidate_remote_urls(url: str):
    normalized = _ensure_scheme(_normalize_url(url))
    parsed = urlparse(normalized)
    scheme = parsed.scheme or "http"
    host = parsed.hostname or ""

    if not host:
        return []

    if parsed.port:
        return [f"{scheme}://{host}:{parsed.port}"]

    return [f"{scheme}://{host}:{port}" for port in REMOTE_API_PORTS]


def _remote_is_available(base_url: str) -> bool:
    try:
        req = request.Request(f"{base_url}/api/config", method="GET")
        with request.urlopen(req, timeout=2) as response:
            return 200 <= response.status < 300
    except Exception:
        return False


def _get_remote_candidate_urls(target_url: str | None = None) -> list[str]:
    if target_url:
        return _candidate_remote_urls(_normalize_url(target_url))

    configured_url = _normalize_url(os.getenv("REMOTE_API_URL"))
    if configured_url and not _is_loopback_url(configured_url):
        return _candidate_remote_urls(configured_url)

    return _candidate_remote_urls(DEFAULT_REMOTE_API_URL)


def resolve_remote_base_url(target_url: str | None = None) -> str:
    """Resolve a URL remota acessivel para o servidor principal da rede."""
    for candidate in _get_remote_candidate_urls(target_url):
        if _remote_is_available(candidate):
            return candidate
    raise HTTPException(status_code=503, detail=REMOTE_ACCESS_ERROR)


def get_remote_base_url(target_url: str | None = None) -> str:
    """Resolve a melhor URL remota conhecida, mesmo se o servidor nao responder."""
    candidates = _get_remote_candidate_urls(target_url)
    return candidates[0] if candidates else _normalize_url(DEFAULT_REMOTE_API_URL)


def get_local_access_url() -> str:
    """Retorna uma URL válida para abrir no navegador localmente."""
    if DEFAULT_NETWORK_HOST in ("0.0.0.0", "::", ""):
        return f"http://127.0.0.1:{DEFAULT_NETWORK_PORT}"
    return f"http://{DEFAULT_NETWORK_HOST}:{DEFAULT_NETWORK_PORT}"


def _proxy_request(method: str, path: str, payload: dict[str, Any] | None = None, target_url: str | None = None):
    """Encaminha a requisicao para a API principal e devolve o JSON da resposta."""
    base_url = resolve_remote_base_url(target_url)
    url = f"{base_url}{path}"
    data = None
    headers = {}

    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = request.Request(url, data=data, headers=headers, method=method)

    try:
        with request.urlopen(req, timeout=25) as response:
            body = response.read().decode("utf-8", errors="ignore")
            return response.status, json.loads(body) if body else {}
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        try:
            parsed = json.loads(body) if body else {}
        except json.JSONDecodeError:
            parsed = {"detail": body or str(exc)}
        raise HTTPException(status_code=exc.code, detail=parsed.get("detail", parsed)) from exc
    except Exception as exc:  # pragma: no cover - falha de rede
        raise HTTPException(status_code=503, detail=REMOTE_ACCESS_ERROR) from exc


@app.get("/", response_class=HTMLResponse)
def root(request: Request):
    """Carrega a tela de acesso inicial da estação secundária."""
    return templates.TemplateResponse(request, "login.html")


@app.get("/reposicao", response_class=HTMLResponse)
def reposicao_page(request: Request):
    """Carrega a interface principal da aplicação na estação secundária."""
    return templates.TemplateResponse(request, "index.html")


@app.get("/config-etiquetas", response_class=HTMLResponse)
def label_config_page(request: Request):
    """Carrega a tela de configuração de etiquetas da interface principal."""
    return templates.TemplateResponse(request, "label_config.html")


@app.get("/health")
def health():
    """Verifica se a API local está ativa e qual servidor remoto está sendo usado."""
    return {
        "status": "ok",
        "remote_api_url": get_remote_base_url(),
        "local_api_url": get_local_access_url(),
    }


@app.post("/api/remote-config")
def set_remote_target(payload: RemoteTargetRequest):
    """Permite ajustar a URL do servidor remoto em tempo de execução."""
    target_url = (payload.target_url or "").strip()
    if not target_url:
        raise HTTPException(status_code=400, detail="Informe a URL do servidor remoto.")

    os.environ["REMOTE_API_URL"] = target_url
    return {"message": "Servidor remoto configurado com sucesso.", "remote_api_url": get_remote_base_url(target_url)}


@app.get("/api/itens")
def proxy_items(target_url: str | None = None):
    """Encaminha a listagem de itens do servidor para a estação secundária."""
    _, body = _proxy_request("GET", "/api/itens", target_url=target_url)
    return body


@app.get("/api/printers")
def proxy_printers(target_url: str | None = None):
    """Encaminha a listagem de impressoras do servidor."""
    _, body = _proxy_request("GET", "/api/printers", target_url=target_url)
    return body


@app.get("/api/base/{codigo}")
def proxy_base_item(codigo: str, target_url: str | None = None):
    """Encaminha a busca de um código na base do servidor remoto."""
    _, body = _proxy_request("GET", f"/api/base/{codigo}", target_url=target_url)
    return body


@app.get("/api/config")
def proxy_config(target_url: str | None = None):
    """Encaminha a configuração do servidor para a máquina secundária."""
    _, body = _proxy_request("GET", "/api/config", target_url=target_url)
    body["remote_api_url"] = get_remote_base_url(target_url)
    return body


@app.get("/api/label-config")
def proxy_label_config(target_url: str | None = None):
    """Encaminha a configuração de etiquetas do servidor para a estação secundária."""
    _, body = _proxy_request("GET", "/api/label-config", target_url=target_url)
    body["remote_api_url"] = get_remote_base_url(target_url)
    return body


@app.post("/api/label-config")
def proxy_set_label_config(payload: dict[str, Any], target_url: str | None = None):
    """Envia alterações de etiquetas para o servidor remoto."""
    _, body = _proxy_request("POST", "/api/label-config", payload=payload, target_url=target_url)
    return body


@app.post("/api/label-config/reset")
def proxy_reset_label_config(target_url: str | None = None):
    """Restaura os perfis de etiqueta no servidor remoto."""
    _, body = _proxy_request("POST", "/api/label-config/reset", target_url=target_url)
    return body


@app.post("/api/imprimir")
def proxy_print(payload: PrintRequest, target_url: str | None = None):
    """Envia uma impressão para o servidor remoto."""
    _, body = _proxy_request("POST", "/api/imprimir", payload=payload.model_dump(), target_url=target_url)
    return body


@app.post("/api/imprimir-todos")
def proxy_print_all(target_url: str | None = None):
    """Envia a impressão em lote para o servidor remoto."""
    _, body = _proxy_request("POST", "/api/imprimir-todos", target_url=target_url)
    return body


def main():
    """Entrada da API secundária para uso em rede."""
    server_url = f"http://{DEFAULT_NETWORK_HOST}:{DEFAULT_NETWORK_PORT}"
    browser_url = get_local_access_url()

    def run_server():
        uvicorn.run(app, host=DEFAULT_NETWORK_HOST, port=DEFAULT_NETWORK_PORT, reload=False, access_log=False)

    thread = threading.Thread(target=run_server, daemon=True)
    thread.start()

    for _ in range(30):
        try:
            import urllib.request

            with urllib.request.urlopen(browser_url + "/health", timeout=2):
                break
        except Exception:
            time.sleep(0.5)

    print(f"Abrindo a interface em {browser_url}")
    try:
        webbrowser.open(browser_url)
    except Exception:
        print("Não foi possível abrir o navegador automaticamente. Use esta URL manualmente:")
        print(browser_url)

    thread.join()


if __name__ == "__main__":
    main()
