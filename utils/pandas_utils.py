import pandas as pd
from pathlib import Path
from typing import Any

def _ler_csv(caminho: Path) -> pd.DataFrame:

    """
    Função retorna o dataframe do pandas para centralizar consultas e diminuir escrita
    """
    
    if not caminho.exists() or caminho.stat().st_size == 0:
        return pd.DataFrame()

    for encoding in ("utf-8", "latin1"):
        try:
            df = pd.read_csv(
                caminho,
                sep=None,
                encoding=encoding,
                engine="python",
                quotechar='"',
                on_bad_lines="skip",
            )
            return df.fillna("")
        except Exception:
            continue

    return pd.DataFrame()

def _proximo_id(df: pd.DataFrame) -> int:
    """
    Calcula qual será o proximo id, quando passarmos para o banco de dados isso não será útil
    """

    if df.empty or "id" not in df.columns:
        return 1

    ids = pd.to_numeric(df["id"], errors="coerce").dropna()
    if ids.empty:
        return 1

    return int(ids.max()) + 1


def _append_csv(caminho: Path, linha: dict[str, Any]) -> None:

    """
    salva os dados nas suas respectivas colunas
    """
    df_linha = pd.DataFrame([linha])

    if not caminho.exists() or caminho.stat().st_size == 0:
        df_linha.to_csv(caminho, index=False, encoding="utf-8")
        return

    df_linha.to_csv(
        caminho,
        mode="a",
        index=False,
        header=False,
        encoding="utf-8",
    )
