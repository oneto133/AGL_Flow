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
        # Expande a planilha para uma linha por refugo da inspeção.
        caminho_refugos = Path(caminho_csv).with_name("inspecoes_refugo.csv")
        df_refugos = pd.read_csv(
            caminho_refugos,
            dtype=str,
            engine="python",
            on_bad_lines="skip",
        ).fillna("") if caminho_refugos.exists() else pd.DataFrame()

        colunas_relatorio = [
            "op",
            "codigo",
            "descricao",
            "quantidade",
            "data_hora_inicio_inspecao",
            "data_hora_fim_inspecao",
            "status",
            "observacao geral",
            "item conferido",
            "codigo nc",
            "observacao_refugo",
        ]

        if df_refugos.empty or "id_inspecao" not in df_refugos.columns:
            df["observacao geral"] = df.get("observacao", "")
            df["item conferido"] = ""
            df["codigo nc"] = ""
            df["observacao_refugo"] = ""
        else:
            df["id"] = df["id"].astype(str).str.strip()
            df_refugos["id_inspecao"] = df_refugos["id_inspecao"].astype(str).str.strip()
            linhas = []

            for _, inspecao in df.iterrows():
                refugos = df_refugos.loc[
                    df_refugos["id_inspecao"] == str(inspecao.get("id", "")).strip()
                ]

                if refugos.empty:
                    refugos = [None]
                else:
                    refugos = refugos.to_dict(orient="records")

                for refugo in refugos:
                    linha = inspecao.to_dict()
                    linha["observacao geral"] = str(inspecao.get("observacao", "")).strip()

                    if refugo is None:
                        linha["item conferido"] = ""
                        linha["codigo nc"] = ""
                        linha["observacao_refugo"] = ""
                    else:
                        linha["item conferido"] = str(refugo.get("descricao", "")).strip()
                        linha["codigo nc"] = str(refugo.get("codigo_nc", "")).strip()
                        linha["observacao_refugo"] = str(refugo.get("observacao", "")).strip()

                    linhas.append(linha)

            df = pd.DataFrame(linhas)

        for coluna in colunas_relatorio:
            if coluna not in df.columns:
                df[coluna] = ""

        df = df[colunas_relatorio]
    
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