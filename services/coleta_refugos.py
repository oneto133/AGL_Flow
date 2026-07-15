import pandas as pd
from datetime import datetime
from config.paths import CSV_DIR
from schemas import RegistrarColeta
from pathlib import Path

def _registrar_contagem(dados: RegistrarColeta):

    caminho = CSV_DIR / "registro_refugos.csv"

    data_atual = (
        dados.data_hora or datetime.now()
    ).strftime("%d/%m/%Y %H:%M:%S")

    descricao = consultar_descricao(dados.codigo)

    nova_linha = {
        "codigo": str(dados.codigo),
        "descricao": descricao,
        "quantidade": dados.quantidade,
        "local": dados.local,
        "data_hora": data_atual,
        "responsavel": getattr(dados, "responsavel", ""),
        "observacao": getattr(dados, "observacao", "")
    }

    df = pd.DataFrame([nova_linha])

    # evita problema de arquivo inexistente
    if not caminho.exists():
        df.to_csv(caminho, index=False, encoding="utf-8")
    else:
        df.to_csv(
            caminho,
            mode="a",
            index=False,
            header=False,
            encoding="utf-8"
        )

    return True
def buscar_produtos():
    caminho_base = CSV_DIR / "base_itens_refugo.csv"

    df = pd.read_csv(
        caminho_base,
        dtype={"codigo": str},
        encoding="utf-8",
        engine="python",
        quotechar='"'
    )

    df = df.fillna("")

    return df.to_dict(orient="records")

def consultar_descricao(codigo: int):

    caminho_base = CSV_DIR / "base_itens_refugo.csv"

    df = pd.read_csv(
        caminho_base,
        dtype={"codigo": str},
        encoding="utf-8",
        engine="python",
        quotechar='"'
    )

    resultado = df.loc[df["codigo"] == str(codigo), "descricao"]

    if not resultado.empty:
        return resultado.iloc[0]

    return ""
def contados_hoje():

    caminho = CSV_DIR / "registro_refugos.csv"

    if not caminho.exists():
        return []

    df = pd.read_csv(
        caminho,
        dtype={"codigo": str},
        encoding="utf-8",
        engine="python",
        quotechar='"'
    )

    if df.empty:
        return []

    df["data_hora_dt"] = pd.to_datetime(
        df["data_hora"],
        format="%d/%m/%Y %H:%M:%S",
        errors="coerce"
    )

    hoje = datetime.now().date()

    df = df.loc[df["data_hora_dt"].dt.date == hoje]

    df = df.drop(columns=["data_hora_dt"])

    df = df.fillna("")

    return df.to_dict(orient="records")

def csv_para_xlsx(caminho_csv: str, caminho_xlsx: str):

    df = pd.read_csv(caminho_csv, dtype={"codigo": str})

    df = df.fillna("")

    df.to_excel(caminho_xlsx, index=False, engine="openpyxl")

    return caminho_xlsx

def xlsx_para_csv(caminho_xlsx: str, caminho_csv: str):
    destino = Path(caminho_csv).name.lower()
    df = pd.read_excel(caminho_xlsx, dtype=str)
    df = df.fillna("")

    if destino == "base_qualidade.csv":
        df.columns = [str(coluna).strip() for coluna in df.columns]
        df = df.loc[:, [coluna for coluna in df.columns if coluna and not str(coluna).startswith("Unnamed")]]
    else:
        if "codigo" not in df.columns or "descricao" not in df.columns:
            raise ValueError("Arquivo inválido. Precisa de codigo e descricao")

        df = df[["codigo", "descricao"]]

    df.to_csv(caminho_csv, index=False, encoding="utf-8")
    return caminho_csv

def exportar_contagens_para_xlsx(caminho_csv: str, caminho_saida_xlsx: str):
    nome_arquivo = Path(caminho_csv).name.lower()
    df = pd.read_csv(caminho_csv, dtype=str, engine="python", on_bad_lines="skip")
    df = df.fillna("")

    if nome_arquivo == "base_qualidade.csv":
        if "codigo" not in df.columns and "código" in df.columns:
            df = df.rename(columns={"código": "codigo"})

        colunas = [col for col in df.columns if col not in {"", ".2"}]
        if "codigo" in colunas:
            colunas.remove("codigo")
            colunas.insert(0, "codigo")
        if "descricao" in colunas:
            colunas.remove("descricao")
            colunas.insert(1 if "codigo" in colunas else 0, "descricao")

        df = df[colunas]

    elif nome_arquivo == "inspecoes.csv":
        pass
    
    else:
        colunas = [
            "codigo",
            "descricao",
            "quantidade",
            "local",
            "data_hora",
            "responsavel",
            "observacao",
        ]

        for col in colunas:
            if col not in df.columns:
                df[col] = ""

        df = df[colunas]

    df.to_excel(caminho_saida_xlsx, index=False, engine="openpyxl")
    return caminho_saida_xlsx

def importar_base_xlsx(caminho_xlsx: str, caminho_csv: str):

    df = pd.read_excel(caminho_xlsx, dtype={"codigo": str})

    if "codigo" not in df.columns or "descricao" not in df.columns:
        raise ValueError("Arquivo inválido. Precisa ter codigo e descricao.")

    df = df[["codigo", "descricao"]]

    df = df.fillna("")

    df.to_csv(caminho_csv, index=False, encoding="utf-8")

    return caminho_csv

if __name__ == "__main__":
    """
        dados = RegistrarColeta(
            codigo=804462,
            quantidade=1,
            local="furadeiras",
        )
        _registrar_contagem(
            dados
        )
    """

    print(buscar_produtos())

