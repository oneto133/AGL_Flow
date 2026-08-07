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
        # Gera uma linha por item conferido, incluindo a quantidade refugada.
        caminho_itens = Path(caminho_csv).with_name("inspecoes_itens.csv")
        caminho_refugos = Path(caminho_csv).with_name("inspecoes_refugo.csv")
        df_itens = pd.read_csv(caminho_itens, dtype=str, engine="python", on_bad_lines="skip").fillna("") if caminho_itens.exists() else pd.DataFrame()
        df_refugos = pd.read_csv(caminho_refugos, dtype=str, engine="python", on_bad_lines="skip").fillna("") if caminho_refugos.exists() else pd.DataFrame()
        caminho_seq = Path(caminho_csv).with_name("sequenciamento.csv")
        caminho_config = Path(caminho_csv).with_name("config_linhas.csv")
        df_seq = pd.read_csv(caminho_seq, dtype=str, engine="python", on_bad_lines="skip").fillna("") if caminho_seq.exists() else pd.DataFrame()
        df_config = pd.read_csv(caminho_config, dtype=str, engine="python", on_bad_lines="skip").fillna("") if caminho_config.exists() else pd.DataFrame()

        colunas_relatorio = [
            "op",
            "codigo",
            "descricao",
            "secao",
            "quantidade",
            "data_hora_inicio_inspecao",
            "data_hora_fim_inspecao",
            "status",
            "item conferido",
            "quantidade refugada",
            "codigo nc",
            "observacao_refugo",
            "observacao geral",
        ]

        secao_por_linha = {}
        if not df_config.empty and {"celula_linha", "secao"}.issubset(df_config.columns):
            secao_por_linha = dict(zip(df_config["celula_linha"].str.strip(), df_config["secao"].str.strip()))
        linha_por_op = {}
        if not df_seq.empty and {"op", "linha"}.issubset(df_seq.columns):
            linha_por_op = dict(zip(df_seq["op"].astype(str).str.strip(), df_seq["linha"].str.strip()))

        itens_por_inspecao = {}
        if not df_itens.empty and "id_inspecao" in df_itens.columns:
            for id_inspecao, grupo in df_itens.groupby(df_itens["id_inspecao"].astype(str).str.strip()):
                itens_por_inspecao[id_inspecao] = grupo.to_dict(orient="records")

        refugos_por_inspecao = {}
        if not df_refugos.empty and "id_inspecao" in df_refugos.columns:
            for id_inspecao, grupo in df_refugos.groupby(df_refugos["id_inspecao"].astype(str).str.strip()):
                refugos_por_inspecao[id_inspecao] = grupo.to_dict(orient="records")

        linhas = []
        df["id"] = df.get("id", "").astype(str).str.strip()
        for _, inspecao in df.iterrows():
            id_inspecao = str(inspecao.get("id", "")).strip()
            refugos = refugos_por_inspecao.get(id_inspecao, [])
            linha = linha_por_op.get(str(inspecao.get("op", "")).strip(), "")
            secao = secao_por_linha.get(linha, "")
            itens = itens_por_inspecao.get(id_inspecao, [])
            registros_item = refugos if refugos else (itens[:1] or [{}])

            for item in registros_item:
                registro = inspecao.to_dict()
                registro["secao"] = secao
                item_codigo = str(item.get("codigo", "")).strip()
                item_descricao = str(item.get("descricao", "")).strip()
                refugos_item = [item] if refugos else [{}]

                # Item sem refugo aparece uma vez; item com vários refugos é repetido.
                for refugo in refugos_item:
                    registro_item = registro.copy()
                    registro_item["item conferido"] = item_descricao
                    registro_item["quantidade refugada"] = str(refugo.get("quantidade", "0") or "0").strip()
                    registro_item["codigo nc"] = str(refugo.get("codigo_nc", "")).strip()
                    registro_item["observacao_refugo"] = str(refugo.get("observacao", "")).strip()
                    registro_item["observacao geral"] = str(inspecao.get("observacao", "")).strip()
                    linhas.append(registro_item)
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
