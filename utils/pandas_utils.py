import pandas as pd
from pathlib import Path

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
