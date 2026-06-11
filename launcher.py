import os
import ipaddress
import socket
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

from app import app


DEFAULT_PORTS = (8000, 8001, 8002)


def porta_disponível(port, host="0.0.0.0"):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
        except OSError:
            return False
        return True


def select_port():
    for port in DEFAULT_PORTS:
        if porta_disponível(port):
            return port
    raise RuntimeError("Nenhuma porta disponivel entre 8000 e 8002.")


def get_lan_ip():
    candidates = []

    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET, socket.SOCK_STREAM):
            candidate = info[4][0]
            if candidate and candidate not in candidates:
                candidates.append(candidate)
    except OSError:
        pass

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            ip_address = sock.getsockname()[0]
            if ip_address and ip_address not in candidates:
                candidates.append(ip_address)
    except OSError:
        pass

    for candidate in candidates:
        try:
            ip_obj = ipaddress.ip_address(candidate)
        except ValueError:
            continue

        if ip_obj.version == 4 and not (ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_unspecified):
            if ip_obj.is_private:
                return candidate

    for candidate in candidates:
        try:
            ip_obj = ipaddress.ip_address(candidate)
        except ValueError:
            continue

        if ip_obj.version == 4 and not (ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_unspecified):
            return candidate

    return "127.0.0.1"


def wait_for_server(port, timeout=60):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=2):
                return True
        except OSError:
            time.sleep(0.5)
    return False


def serve():
    import uvicorn
    import sys as _sys

    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    if getattr(_sys, "stderr", None) is None:
        class _NullStream:
            def write(self, *_args, **_kwargs):
                return 0

            def flush(self):
                return None

            def isatty(self):
                return False

        _sys.stderr = _NullStream()
    if getattr(_sys, "stdout", None) is None:
        class _NullStream:
            def write(self, *_args, **_kwargs):
                return 0

            def flush(self):
                return None

            def isatty(self):
                return False

        _sys.stdout = _NullStream()
    uvicorn.run(
        app,
        host=host,
        port=port,
        reload=False,
        access_log=False,
        log_config=None,
    )


def run_network_api():
    """Inicia a API secundária usada por máquinas da rede para acessar o servidor principal."""
    import network_api

    network_api.main()


def launch_browser_app():
    port = select_port()
    env = os.environ.copy()
    env["PORT"] = str(port)
    env["HOST"] = "0.0.0.0"
    if getattr(sys, "frozen", False):
        command = [str(Path(sys.executable)), "--serve"]
        cwd = str(Path(sys.executable).resolve().parent)
    else:
        command = [str(Path(sys.executable)), str(Path(__file__).resolve()), "--serve"]
        cwd = str(Path(__file__).resolve().parent)

    process = subprocess.Popen(command, env=env, cwd=cwd)

    try:
        if not wait_for_server(port):
            raise RuntimeError("Backend did not become ready in time.")

        webbrowser.open(f"http://{get_lan_ip()}:{port}")
        process.wait()
    except KeyboardInterrupt:
        pass
    finally:
        if process.poll() is None:
            process.terminate()


if __name__ == "__main__":
    if "--serve" in sys.argv:
        serve()
    elif "--network-api" in sys.argv:
        run_network_api()
    else:
        launch_browser_app()
