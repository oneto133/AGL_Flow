import csv
import unicodedata
from contextvars import ContextVar
from functools import lru_cache
from pathlib import Path

PERMISSIONS_CSV = Path(__file__).resolve().parents[1] / "dados" / "csv" / "permissoes.csv"
CURRENT_USER: ContextVar[dict | None] = ContextVar("CURRENT_USER", default=None)


def normalize_text(value):
    text = "" if value is None else str(value)
    normalized = unicodedata.normalize("NFKD", text)
    plain = "".join(char for char in normalized if not unicodedata.combining(char))
    return " ".join(plain.strip().lower().split())


def _sector_aliases(value):
    sector = normalize_text(value)
    if not sector:
        return set()

    aliases = {sector}
    aliases.add(sector.replace(" ", ""))
    aliases.add(sector.rstrip("s"))
    aliases.add(sector[:-2] if sector.endswith("es") else sector)
    return {alias for alias in aliases if alias}


def sector_matches(sector, text):
    sector_aliases = _sector_aliases(sector)
    if not sector_aliases:
        return False

    normalized_text = normalize_text(text).replace(" ", "")
    return any(alias.replace(" ", "") in normalized_text for alias in sector_aliases)


@lru_cache(maxsize=1)
def _load_permission_index():
    users = {}

    if not PERMISSIONS_CSV.is_file():
        return users

    with PERMISSIONS_CSV.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        for row in reader:
            username = normalize_text(row.get("usuario"))
            password = str(row.get("senha") or "").strip()
            if not username or not password:
                continue

            key = (username, password)
            user = users.setdefault(
                key,
                {
                    "usuario": str(row.get("usuario") or "").strip(),
                    "senha": password,
                    "setores": set(),
                    "permissoes": set(),
                    "is_admin": username == "admin",
                },
            )

            setor = str(row.get("setor") or "").strip()
            permissao = normalize_text(row.get("permissao"))

            if setor:
                user["setores"].add(setor)
            if permissao:
                user["permissoes"].add(permissao)
            if username == "admin" or setor.lower() == "admin" or permissao == "admin":
                user["is_admin"] = True

    return users


def authenticate_user(username, password):
    key = (normalize_text(username), str(password or "").strip())
    user = _load_permission_index().get(key)
    if not user:
        return None

    return {
        "usuario": user["usuario"],
        "setor": next(iter(sorted(user["setores"])), ""),
        "setores": sorted(user["setores"]),
        "permissoes": sorted(user["permissoes"]),
        "is_admin": bool(user["is_admin"]),
    }


def set_current_user(user):
    return CURRENT_USER.set(user)


def reset_current_user(token):
    CURRENT_USER.reset(token)


def clear_current_user():
    CURRENT_USER.set(None)


def get_current_user():
    return CURRENT_USER.get()


def user_has_permission(user, permission):
    if not user:
        return False
    if user.get("is_admin"):
        return True

    normalized_permission = normalize_text(permission)
    return normalized_permission in {normalize_text(item) for item in user.get("permissoes", [])}


def user_can_access_sector(user, sector):
    if not user:
        return False
    if user.get("is_admin"):
        return True
    if not sector:
        return True

    user_sectors = user.get("setores", [])
    if not user_sectors:
        return False

    return any(normalize_text(sector) == normalize_text(user_sector) for user_sector in user_sectors)

