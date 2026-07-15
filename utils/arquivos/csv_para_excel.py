import pandas as pd
from pathlib import Path

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

    if "data_hora_fim_inspecao" in df.columns:
        df["data_hora_inicio_inspecao"] = pd.to_datetime(df["data_hora_inicio_inspecao"], errors="coerce")
        df["data_hora_fim_inspecao"] = pd.to_datetime(df["data_hora_fim_inspecao"], errors="coerce")

        df["data_hora_inicio_inspecao"] = df["data_hora_inicio_inspecao"].dt.strftime("%d/%m/%Y %H:%M:%S")
        df["data_hora_fim_inspecao"] = df["data_hora_fim_inspecao"].dt.strftime("%d/%m/%Y %H:%M:%S")

        df["data_hora_inicio_inspecao"] = df["data_hora_inicio_inspecao"].fillna("")
        df["data_hora_fim_inspecao"] = df["data_hora_fim_inspecao"].fillna("")

        df = df.drop(columns=["qtd_etiquetas"], errors="ignore")
        

    df.to_excel(caminho_saida_xlsx, index=False, engine="openpyxl")
    return caminho_saida_xlsx