from __future__ import annotations

import asyncio
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd

from config import CSV_DIR
from schemas import InspecaoCreate, ItemInspecionado, RefugoInspecao
from utils import _ler_csv, normalize_text


SEQUENCIAMENTO = CSV_DIR / "sequenciamento.csv"
CONFIG_LINHAS = CSV_DIR / "config_linhas.csv"
BASE_QUALIDADE = CSV_DIR / "base_qualidade.csv"
INSPECOES = CSV_DIR / "inspecoes.csv"
INSPECOES_ITENS = CSV_DIR / "inspecoes_itens.csv"
INSPECOES_REFUGO = CSV_DIR / "inspecoes_refugo.csv"
INSPECOES_DADOS = CSV_DIR / "inspecoes_dados.csv"

SECOES_ORDEM = ["deslizante", "newbv", "basculante", "pivotante"]
SECOES_ROTULO = {
    "deslizante": "Deslizante",
    "newbv": "NEW BV",
    "basculante": "Basculante",
    "pivotante": "Pivotante",
}


def _normalizar_secao(valor: Any) -> str:
    return normalize_text(valor).replace(" ", "")


def _to_int(value: Any, fallback: int = 0) -> int:
    numero = pd.to_numeric(pd.Series([value]), errors="coerce").iloc[0]
    if pd.isna(numero):
        return fallback
    return int(numero)


def _normalizar_coluna(coluna: Any) -> str:
    return normalize_text(coluna).replace(" ", "_")


def _carregar_config_linhas() -> pd.DataFrame:
    df = _ler_csv(CONFIG_LINHAS)
    if df.empty:
        return df

    for coluna in ("secao", "celula_linha", "id_lista", "cor_cartao"):
        if coluna not in df.columns:
            df[coluna] = ""

    df["secao_normalizada"] = df["secao"].map(_normalizar_secao)
    return df


def _carregar_sequenciamento() -> pd.DataFrame:
    df = _ler_csv(SEQUENCIAMENTO)
    if df.empty:
        return df

    for coluna in (
        "op",
        "codigo_produto",
        "descricao_produto",
        "quantidade",
        "linha",
        "status",
        "fila",
        "data_hora_sequenciamento",
        "data_hora_finalizacao",
    ):
        if coluna not in df.columns:
            df[coluna] = ""

    return df


def _carregar_base_qualidade() -> pd.DataFrame:
    df = _ler_csv(BASE_QUALIDADE)
    if df.empty:
        return df

    df.columns = [str(coluna).strip() for coluna in df.columns]
    return df


def _coluna_base_por_nome(df: pd.DataFrame, nomes: set[str]) -> str | None:
    for coluna in df.columns:
        if _normalizar_coluna(coluna) in nomes:
            return coluna
    return None


def _linha_base_qualidade_por_codigo(codigo: int | str) -> pd.Series | None:
    df_base = _carregar_base_qualidade()
    if df_base.empty:
        return None

    coluna_codigo = _coluna_base_por_nome(df_base, {"codigo", "codigo_pai"})
    if coluna_codigo is None:
        return None

    alvo = str(codigo).strip()
    filtro = df_base.loc[df_base[coluna_codigo].astype(str).str.strip() == alvo]
    if filtro.empty:
        return None

    return filtro.iloc[0]


def _descricao_base_qualidade_por_codigo(codigo: int | str) -> str:
    linha = _linha_base_qualidade_por_codigo(codigo)
    if linha is None:
        return ""

    for coluna in ("Modelo", "modelo", "Descricao", "descricao"):
        if coluna in linha.index and str(linha.get(coluna, "")).strip():
            return str(linha.get(coluna, "")).strip()

    return str(linha.get(linha.index[0], "")).strip()


def _extrair_tensao(texto: Any) -> str:
    texto_normalizado = normalize_text(texto)
    if "127" in texto_normalizado:
        return "127"
    if "220" in texto_normalizado:
        return "220"
    if "380" in texto_normalizado:
        return "380"
    if "440" in texto_normalizado:
        return "440"
    return ""


def _itens_disponiveis_por_codigo(codigo: int | str) -> list[dict[str, Any]]:
    df_base = _carregar_base_qualidade()
    if df_base.empty:
        return []

    coluna_codigo = None
    for coluna in df_base.columns:
      if _normalizar_coluna(coluna) in {"codigo", "codigo_pai"}:
            coluna_codigo = coluna
            break

    if coluna_codigo is None:
        return []

    alvo = str(codigo).strip()
    filtro = df_base.loc[df_base[coluna_codigo].astype(str).str.strip() == alvo]
    if filtro.empty:
        return []

    linha = filtro.iloc[0]
    itens: list[dict[str, Any]] = []

    for coluna in df_base.columns:
        coluna_normalizada = _normalizar_coluna(coluna)
        if coluna in {coluna_codigo, "modelo"} or coluna_normalizada in {"codigo", "codigo_pai", "modelo"}:
            continue

        valor = linha.get(coluna, "")
        texto = str(valor).strip()
        if not texto or texto == "-" or not coluna_normalizada or coluna_normalizada.startswith("."):
            continue

        itens.append(
            {
                "campo": coluna_normalizada,
                "titulo": str(coluna).strip(),
                "valor": texto,
                "descricao": f"{str(coluna).strip()}: {texto}",
                "codigo_pai": _to_int(codigo),
            }
        )

    return itens


def _linhas_da_secao(secao: str) -> pd.DataFrame:
    df_config = _carregar_config_linhas()
    if df_config.empty:
        return df_config

    alvo = _normalizar_secao(secao)
    return df_config.loc[df_config["secao_normalizada"] == alvo].copy()


def _ops_ativas_da_linha(df_seq: pd.DataFrame, linha: str) -> pd.DataFrame:
    if df_seq.empty:
        return df_seq

    alvo = normalize_text(linha)
    df = df_seq.loc[df_seq["linha"].astype(str).map(normalize_text) == alvo].copy()

    if "status" in df.columns:
        df["status_normalizado"] = df["status"].fillna("").astype(str).map(normalize_text)
        df = df.loc[df["status_normalizado"] != "concluido"]

    if "fila" in df.columns:
        df["fila_num"] = pd.to_numeric(df["fila"], errors="coerce")
        df = df.sort_values(by=["fila_num", "data_hora_sequenciamento"], na_position="last")

    return df


def _serializar_op(row: pd.Series) -> dict[str, Any]:
    return {
        "op": _to_int(row.get("op")),
        "codigo": _to_int(row.get("codigo_produto")),
        "descricao": str(row.get("descricao_produto", "")).strip(),
        "quantidade": _to_int(row.get("quantidade")),
        "linha": str(row.get("linha", "")).strip(),
        "status": str(row.get("status", "")).strip(),
        "fila": _to_int(row.get("fila")),
        "data_hora_sequenciamento": str(row.get("data_hora_sequenciamento", "")).strip(),
        "data_hora_finalizacao": str(row.get("data_hora_finalizacao", "")).strip(),
    }


def _ultimo_status_qualidade(op: int | str) -> str:
    df_inspecoes = _ler_csv(INSPECOES)
    if df_inspecoes.empty or "op" not in df_inspecoes.columns:
        return ""

    filtro = df_inspecoes.loc[df_inspecoes["op"].astype(str) == str(op)]
    if filtro.empty:
        return ""

    linha = filtro.iloc[-1]
    return str(linha.get("status", "")).strip()


def _ultima_conferencia_por_op(op: int | str) -> str:
    df_inspecoes = _ler_csv(INSPECOES)
    if df_inspecoes.empty or "op" not in df_inspecoes.columns:
        return ""

    filtro = df_inspecoes.loc[df_inspecoes["op"].astype(str) == str(op)].copy()
    if filtro.empty:
        return ""

    if "data_hora_fim_inspecao" in filtro.columns:
      filtro["data_fim_dt"] = pd.to_datetime(filtro["data_hora_fim_inspecao"], errors="coerce")
    else:
      filtro["data_fim_dt"] = pd.NaT

    if "data_hora_inicio_inspecao" in filtro.columns:
      filtro["data_inicio_dt"] = pd.to_datetime(filtro["data_hora_inicio_inspecao"], errors="coerce")
    else:
      filtro["data_inicio_dt"] = pd.NaT

    filtro["data_referencia_dt"] = filtro["data_fim_dt"].fillna(filtro["data_inicio_dt"])
    filtro = filtro.sort_values(by=["data_referencia_dt"], ascending=False)
    referencia = filtro.iloc[0].get("data_referencia_dt")

    if pd.isna(referencia):
        return ""

    referencia_dt = pd.to_datetime(referencia, errors="coerce")
    if pd.isna(referencia_dt):
        return ""

    return referencia_dt.isoformat()


def _ultima_observacao_qualidade(op: int | str) -> str:
    df_inspecoes = _ler_csv(INSPECOES)
    if df_inspecoes.empty or "op" not in df_inspecoes.columns:
        return ""

    filtro = df_inspecoes.loc[df_inspecoes["op"].astype(str) == str(op)].copy()
    if filtro.empty or "data_hora_fim_inspecao" not in filtro.columns:
        return str(filtro.iloc[-1].get("observacao", "")).strip() if not filtro.empty else ""

    filtro["data_fim_dt"] = pd.to_datetime(filtro["data_hora_fim_inspecao"], errors="coerce")
    filtro = filtro.sort_values(by=["data_fim_dt"], ascending=False)
    linha = filtro.iloc[0]
    return str(linha.get("observacao", "")).strip()


def _ultima_inspecao_por_op(op: int | str) -> dict[str, Any] | None:
    df_inspecoes = _ler_csv(INSPECOES)
    if df_inspecoes.empty or "op" not in df_inspecoes.columns:
        return None

    filtro = df_inspecoes.loc[df_inspecoes["op"].astype(str) == str(op)].copy()
    if filtro.empty:
        return None

    if "data_hora_fim_inspecao" in filtro.columns:
        filtro["data_fim_dt"] = pd.to_datetime(filtro["data_hora_fim_inspecao"], errors="coerce")
    else:
        filtro["data_fim_dt"] = pd.NaT

    if "data_hora_inicio_inspecao" in filtro.columns:
        filtro["data_inicio_dt"] = pd.to_datetime(filtro["data_hora_inicio_inspecao"], errors="coerce")
    else:
        filtro["data_inicio_dt"] = pd.NaT

    filtro["data_referencia_dt"] = filtro["data_fim_dt"].fillna(filtro["data_inicio_dt"])
    filtro = filtro.sort_values(by=["data_referencia_dt", "id"], ascending=False)
    row = filtro.iloc[0]
    id_inspecao = _to_int(row.get("id", 0))

    if not id_inspecao:
        return None

    try:
        return buscar_inspecao_dados_por_id(id_inspecao)
    except ValueError:
        return None


def _serializar_op_com_status_qualidade(row: pd.Series) -> dict[str, Any]:
    op = _serializar_op(row)
    status_qualidade = _ultimo_status_qualidade(op["op"])
    if status_qualidade:
        op["status_qualidade"] = status_qualidade
        op["status"] = status_qualidade
    else:
        op["status_qualidade"] = op["status"]

    op["data_ultima_conferencia"] = _ultima_conferencia_por_op(op["op"])
    op["observacao"] = _ultima_observacao_qualidade(op["op"])

    return op


def listar_secoes_inspecao() -> list[dict[str, Any]]:
    df_config = _carregar_config_linhas()
    df_seq = _carregar_sequenciamento()

    if df_config.empty:
        return []

    secoes: list[dict[str, Any]] = []
    secao_keys = list(dict.fromkeys(df_config["secao_normalizada"].tolist()))

    ordenadas = [secao for secao in SECOES_ORDEM if secao in secao_keys]
    ordenadas.extend([secao for secao in secao_keys if secao not in ordenadas])

    for secao_normalizada in ordenadas:
        linhas_secao = df_config.loc[df_config["secao_normalizada"] == secao_normalizada]
        linhas: list[dict[str, Any]] = []

        for _, row in linhas_secao.iterrows():
            ops_linha = _ops_ativas_da_linha(df_seq, row.get("celula_linha", ""))
            op_atual = _serializar_op_com_status_qualidade(ops_linha.iloc[0]) if not ops_linha.empty else None

            linhas.append(
                {
                    "celula_linha": str(row.get("celula_linha", "")).strip(),
                    "secao": str(row.get("secao", "")).strip(),
                    "secao_normalizada": secao_normalizada,
                    "cor_cartao": str(row.get("cor_cartao", "")).strip(),
                    "id_lista": str(row.get("id_lista", "")).strip(),
                    "quantidade_ops": int(len(ops_linha)),
                    "op_atual": op_atual,
                    "ops": [_serializar_op_com_status_qualidade(item) for _, item in ops_linha.iterrows()],
                }
            )

        secoes.append(
            {
                "secao": secao_normalizada,
                "titulo": SECOES_ROTULO.get(secao_normalizada, str(linhas_secao.iloc[0].get("secao", "")).strip().title()),
                "quantidade_linhas": len(linhas),
                "quantidade_ops": sum(linha["quantidade_ops"] for linha in linhas),
                "linhas": linhas,
            }
        )

    return secoes


def listar_linhas_por_secao(secao: str) -> dict[str, Any]:
    df_config = _linhas_da_secao(secao)
    df_seq = _carregar_sequenciamento()

    if df_config.empty:
        return {
            "secao": _normalizar_secao(secao),
            "titulo": SECOES_ROTULO.get(_normalizar_secao(secao), secao.title()),
            "linhas": [],
        }

    linhas: list[dict[str, Any]] = []
    for _, row in df_config.iterrows():
        ops_linha = _ops_ativas_da_linha(df_seq, row.get("celula_linha", ""))
        linhas.append(
            {
                "celula_linha": str(row.get("celula_linha", "")).strip(),
                "secao": str(row.get("secao", "")).strip(),
                "cor_cartao": str(row.get("cor_cartao", "")).strip(),
                "id_lista": str(row.get("id_lista", "")).strip(),
                "quantidade_ops": int(len(ops_linha)),
                "op_atual": _serializar_op_com_status_qualidade(ops_linha.iloc[0]) if not ops_linha.empty else None,
            }
        )

    secao_normalizada = _normalizar_secao(secao)
    return {
        "secao": secao_normalizada,
        "titulo": SECOES_ROTULO.get(secao_normalizada, secao.title()),
        "linhas": linhas,
    }


def listar_ops_por_linha(linha: str) -> dict[str, Any]:
    df_seq = _carregar_sequenciamento()
    ops = _ops_ativas_da_linha(df_seq, linha)

    return {
        "linha": linha,
        "quantidade_ops": int(len(ops)),
        "ops": [_serializar_op_com_status_qualidade(item) for _, item in ops.iterrows()],
        "op_atual": _serializar_op_com_status_qualidade(ops.iloc[0]) if not ops.empty else None,
    }


def buscar_op_inspecao(op: int | str) -> dict[str, Any]:
    df_seq = _carregar_sequenciamento()
    if df_seq.empty or "op" not in df_seq.columns:
        raise ValueError("Sequenciamento vazio ou sem coluna OP.")

    alvo = str(op).strip()
    filtro = df_seq.loc[df_seq["op"].astype(str) == alvo]
    if filtro.empty:
        raise ValueError(f"OP {op} não encontrada no sequenciamento.")

    linha = filtro.iloc[-1]
    codigo_pai = _to_int(linha.get("codigo_produto"))
    ultima_inspecao = _ultima_inspecao_por_op(op)
    return {
        **_serializar_op_com_status_qualidade(linha),
        "possui_op": True,
        "usuario": "",
        "resultado": "",
        "observacao": _ultima_observacao_qualidade(op) or str(linha.get("observacao", "")).strip(),
        "itens_disponiveis": _itens_disponiveis_por_codigo(codigo_pai),
        "id_inspecao_ultima": _to_int(ultima_inspecao.get("id_inspecao", 0)) if ultima_inspecao else 0,
        "inspecao_ultima": ultima_inspecao or {},
    }


def buscar_produto_inspecao(codigo: int | str) -> dict[str, Any]:
    codigo_texto = str(codigo).strip()
    if not codigo_texto:
        raise ValueError("Código obrigatório.")

    df_seq = _carregar_sequenciamento()
    dados_sequenciamento: dict[str, Any] = {}

    if not df_seq.empty and "codigo_produto" in df_seq.columns:
        filtro_seq = df_seq.loc[df_seq["codigo_produto"].astype(str).str.strip() == codigo_texto]
        if not filtro_seq.empty:
          linha = filtro_seq.iloc[0]
          dados_sequenciamento = {
              "op": _to_int(linha.get("op")),
              "descricao": str(linha.get("descricao_produto", "")).strip(),
              "quantidade": _to_int(linha.get("quantidade")),
              "linha": str(linha.get("linha", "")).strip(),
          }

    linha_base = _linha_base_qualidade_por_codigo(codigo_texto)
    descricao_base = _descricao_base_qualidade_por_codigo(codigo_texto)

    if not dados_sequenciamento and not descricao_base:
        raise ValueError(f"Produto {codigo_texto} não encontrado.")

    descricao = dados_sequenciamento.get("descricao") or descricao_base
    tensao = _extrair_tensao(
        linha_base.get("Estator", "") if linha_base is not None else descricao
    )

    return {
        "codigo": _to_int(codigo_texto),
        "descricao": descricao,
        "quantidade": dados_sequenciamento.get("quantidade", 0),
        "linha": dados_sequenciamento.get("linha", ""),
        "sem_fim": str(linha_base.get("Sem fim", "")).strip() if linha_base is not None else "",
        "central": str(linha_base.get("Modelo", "")).strip() if linha_base is not None else "",
        "tensao": tensao,
        "itens_disponiveis": _itens_disponiveis_por_codigo(codigo_texto),
        "encontrado": True,
    }


def adicionar_item_base_qualidade(codigo: int | str, descricao_item: str) -> dict[str, Any]:
    codigo_texto = str(codigo).strip()
    descricao_texto = str(descricao_item).strip()
    if not codigo_texto or not descricao_texto:
        raise ValueError("Código e descrição do item são obrigatórios.")

    df_base = _carregar_base_qualidade()
    if df_base.empty:
        df_base = pd.DataFrame(columns=["Código"])

    coluna_codigo = _coluna_base_por_nome(df_base, {"codigo", "codigo_pai"}) or df_base.columns[0]
    if descricao_texto not in df_base.columns:
        df_base[descricao_texto] = ""

    alvo = df_base[coluna_codigo].astype(str).str.strip() == codigo_texto if coluna_codigo in df_base.columns else pd.Series([False] * len(df_base))
    if not alvo.any():
        nova_linha = {coluna: "" for coluna in df_base.columns}
        nova_linha[coluna_codigo] = codigo_texto
        df_base = pd.concat([df_base, pd.DataFrame([nova_linha])], ignore_index=True)
        alvo = df_base[coluna_codigo].astype(str).str.strip() == codigo_texto

    df_base.loc[alvo, descricao_texto] = descricao_texto
    df_base.to_csv(BASE_QUALIDADE, index=False, encoding="utf-8")

    return {
        "codigo": _to_int(codigo_texto),
        "descricao_item": descricao_texto,
        "status": "ok",
    }



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


def obter_item_da_op(op: int | str) -> dict[str, Any]:
    """
    Busca no sequenciamento o item vinculado à OP e normaliza os campos
    para o formato usado pelas inspeções.
    """

    df = _ler_csv(SEQUENCIAMENTO)
    if df.empty:
        raise ValueError("Arquivo de sequenciamento vazio ou inexistente.")

    if "op" not in df.columns:
        raise ValueError("Arquivo de sequenciamento sem coluna 'op'.")

    filtro = df.loc[df["op"].astype(str) == str(op)]
    if filtro.empty:
        raise ValueError(f"OP {op} não encontrada no sequenciamento.")

    linha = filtro.iloc[-1]

    codigo = linha.get("codigo_produto", linha.get("codigo", ""))
    descricao = linha.get("descricao_produto", linha.get("descricao", ""))
    quantidade = linha.get("quantidade", 0)

    codigo_numerico = pd.to_numeric(pd.Series([codigo]), errors="coerce").iloc[0]
    quantidade_numerica = pd.to_numeric(pd.Series([quantidade]), errors="coerce").iloc[0]

    return {
        "op": int(op),
        "codigo": int(codigo_numerico) if pd.notna(codigo_numerico) else 0,
        "descricao": str(descricao).strip(),
        "quantidade": int(quantidade_numerica) if pd.notna(quantidade_numerica) else 0,
    }


def montar_item_base_para_salvar(dados: InspecaoCreate) -> dict[str, Any]:
    if dados.possui_op and dados.op is not None:
      try:
          item_base = obter_item_da_op(dados.op)
      except ValueError:
          item_base = {}
    else:
        item_base = {}

    if not item_base:
        produto = buscar_produto_inspecao(dados.codigo)
        item_base = {
            "op": dados.op or 0,
            "codigo": _to_int(dados.codigo),
            "descricao": str(dados.descricao or produto.get("descricao", "")).strip(),
            "quantidade": _to_int(dados.quantidade_programada or dados.quantidade or produto.get("quantidade", 0)),
            "sem_fim": str(dados.sem_fim or produto.get("sem_fim", "")).strip(),
            "central": str(dados.central or produto.get("central", "")).strip(),
            "tensao": str(dados.tensao or produto.get("tensao", "")).strip(),
        }
    else:
        item_base["sem_fim"] = str(dados.sem_fim or item_base.get("sem_fim", "")).strip()
        item_base["central"] = str(dados.central or item_base.get("central", "")).strip()
        item_base["tensao"] = str(dados.tensao or item_base.get("tensao", "")).strip()

    return item_base


def verificar_itens_inspecionados(
    dados: InspecaoCreate,
    item_base: dict[str, Any] | None = None,
) -> list[ItemInspecionado]:
    """
    Normaliza os itens inspecionados da requisição.

    Se o payload trouxer uma lista explícita, ela é usada.
    Caso contrário, o item vinculado à OP vira o item inspecionado principal.
    """

    itens = dados.itens_inspecionados or []
    if itens:
        normalizados: list[ItemInspecionado] = []
        vistos: set[tuple[int, str]] = set()

        for item in itens:
            chave = (item.codigo, normalize_text(item.descricao))
            if chave in vistos:
                continue

            vistos.add(chave)
            normalizados.append(
                ItemInspecionado(
                    id=0,
                    id_inspecao=0,
                    codigo=item.codigo,
                    descricao=item.descricao,
                    campo=item.campo,
                )
            )

        return normalizados

    if item_base is None:
        item_base = obter_item_da_op(dados.op or 0)

    return [
        ItemInspecionado(
            id=0,
            id_inspecao=0,
            codigo=int(item_base["codigo"]),
            descricao=str(item_base["descricao"]),
            campo="item_principal",
        )
    ]


def itens_inspecionados_da_op(op: int | str) -> list[dict[str, Any]]:
    """
    Consulta os itens que já foram gravados como inspecionados para uma OP.
    """

    df_inspecoes = _ler_csv(INSPECOES)
    df_itens = _ler_csv(INSPECOES_ITENS)

    if df_inspecoes.empty or df_itens.empty:
        return []

    if "op" not in df_inspecoes.columns or "id" not in df_inspecoes.columns:
        return []

    ids_inspecao = df_inspecoes.loc[
        df_inspecoes["op"].astype(str) == str(op), "id"
    ].astype(str).tolist()

    if not ids_inspecao or "id_inspecao" not in df_itens.columns:
        return []

    retorno = df_itens.loc[
        df_itens["id_inspecao"].astype(str).isin(ids_inspecao)
    ]

    return retorno.fillna("").to_dict(orient="records")


def itens_inspecionados_da_inspecao(id_inspecao: int | str) -> list[dict[str, Any]]:
    """
    Consulta os itens já gravados para uma inspeção específica.
    """

    df_itens = _ler_csv(INSPECOES_ITENS)
    if df_itens.empty or "id_inspecao" not in df_itens.columns:
        return []

    alvo = str(id_inspecao).strip()
    retorno = df_itens.loc[df_itens["id_inspecao"].astype(str) == alvo]
    return retorno.fillna("").to_dict(orient="records")


def refugos_da_inspecao(id_inspecao: int | str) -> int:
    """
    Consulta os refugos já gravados para uma inspeção específica.
    """

    df_refugos = _ler_csv(INSPECOES_REFUGO)

    if df_refugos.empty or "id_inspecao" not in df_refugos.columns:
        return 0

    alvo = str(id_inspecao).strip()

    df_refugos["id_inspecao"] = df_refugos["id_inspecao"].astype(str).str.strip()
    filtro = df_refugos[df_refugos["id_inspecao"] == alvo]

    if filtro.empty:
        return 0

    return int(pd.to_numeric(filtro["quantidade"], errors="coerce").sum())


def _coletar_refugos(
    dados: InspecaoCreate,
    id_inspecao: int,
    item_base: dict[str, Any],
) -> list[RefugoInspecao]:
    """
    Monta os registros de refugo a partir do payload.

    Quando a lista de refugos não vier preenchida, criamos um registro
    com o item principal da inspeção como fallback.
    """

    if not dados.refugo:
        return []

    refugos = dados.refugos or []
    if not refugos:
        refugos = [
            RefugoInspecao(
                id=0,
                id_inspecao=id_inspecao,
                codigo=int(item_base["codigo"]),
                descricao=str(item_base["descricao"]),
                campo="item_principal",
                quantidade=int(dados.qtd_etiquetas),
                codigo_nc=dados.codigo_nc or "",
                observacao=dados.observacao or "",
            )
        ]

    normalizados: list[RefugoInspecao] = []
    for refugo in refugos:
        normalizados.append(
            RefugoInspecao(
                id=0,
                id_inspecao=id_inspecao,
                codigo=refugo.codigo,
                descricao=refugo.descricao,
                campo=refugo.campo,
                quantidade=refugo.quantidade,
                codigo_nc=refugo.codigo_nc or dados.codigo_nc or "",
                observacao=refugo.observacao or dados.observacao or "",
            )
        )

    return normalizados


def _salvar_inspecao_principal(
    dados: InspecaoCreate,
    item_base: dict[str, Any],
    id_inspecao: int,
) -> None:
    data_inicio = pd.to_datetime(dados.data_hora_inicio_inspecao).isoformat()
    data_fim = pd.to_datetime(dados.data_hora_fim_inspecao).isoformat()

    linha = {
        "id": id_inspecao,
        "op": dados.op or item_base["op"],
        "codigo": item_base["codigo"],
        "descricao": item_base["descricao"],
        "quantidade": item_base["quantidade"],
        "data_hora_inicio_inspecao": data_inicio,
        "data_hora_fim_inspecao": data_fim,
        "possui_op": dados.possui_op,
        "qtd_etiquetas": dados.qtd_etiquetas,
        "status": dados.status,
        "conformidade": dados.conformidade,
        "refugo": dados.refugo,
        "aprovado": dados.aprovado,
        "observacao": str(dados.observacao or "").strip(),
    }

    _append_csv(INSPECOES, linha)


def _salvar_itens_inspecionados(
    itens: list[ItemInspecionado],
    id_inspecao: int,
) -> None:
    if not itens:
        return

    df_existente = _ler_csv(INSPECOES_ITENS)
    proximo_id = _proximo_id(df_existente)

    for item in itens:
        _append_csv(
            INSPECOES_ITENS,
            {
                "id": proximo_id,
                "id_inspecao": id_inspecao,
                "codigo": item.codigo,
                "descricao": item.descricao,
                "campo": item.campo or "",
            },
        )
        proximo_id += 1


def _salvar_refugos(refugos: list[RefugoInspecao], id_inspecao: int) -> None:
    if not refugos:
        return

    df_existente = _ler_csv(INSPECOES_REFUGO)
    proximo_id = _proximo_id(df_existente)

    for refugo in refugos:
        _append_csv(
            INSPECOES_REFUGO,
            {
                "id": proximo_id,
                "id_inspecao": id_inspecao,
                "codigo": refugo.codigo,
                "descricao": refugo.descricao,
                "quantidade": refugo.quantidade,
                "codigo_nc": refugo.codigo_nc,
                "observacao": refugo.observacao,
            },
        )
        proximo_id += 1


def _calcular_codigo_nc(refugos: list[RefugoInspecao]) -> str:
    codigos = []
    for refugo in refugos:
        codigo = str(refugo.codigo_nc or "").strip()
        if codigo and codigo not in codigos:
            codigos.append(codigo)
    return ", ".join(codigos)


def _calcular_observacao(refugos: list[RefugoInspecao], fallback: str = "") -> str:
    observacoes = []
    for refugo in refugos:
        obs = str(refugo.observacao or "").strip()
        if obs and obs not in observacoes:
            observacoes.append(obs)
    if observacoes:
        return " | ".join(observacoes)
    return fallback


def _chave_item_inspecionado(codigo: int | str, descricao: str, campo: str = "") -> tuple[str, str, str]:
    return (
        str(_to_int(codigo)).strip(),
        normalize_text(descricao),
        normalize_text(campo),
    )


def _salvar_inspecao_dados(
    dados: InspecaoCreate,
    item_base: dict[str, Any],
    id_inspecao: int,
    itens_inspecionados: list[ItemInspecionado],
    refugos: list[RefugoInspecao],
) -> None:
    df_existente = _ler_csv(INSPECOES_DADOS)
    proximo_id = _proximo_id(df_existente)

    item_principal = itens_inspecionados[0] if itens_inspecionados else None
    codigo_item = item_principal.codigo if item_principal else _to_int(dados.codigo_item or 0)
    descricao_item = (
        item_principal.descricao if item_principal else str(dados.descricao_item or "").strip()
    )

    quantidade_nc = sum(int(refugo.quantidade or 0) for refugo in refugos)
    codigo_nc = _calcular_codigo_nc(refugos)
    observacao = _calcular_observacao(refugos, str(dados.observacao or "").strip())
    destino = str(dados.destino or "").strip()
    sem_fim = str(dados.sem_fim or item_base.get("sem_fim") or "").strip()
    central = str(dados.central or item_base.get("central") or "").strip()
    tensao = str(dados.tensao or item_base.get("tensao") or "").strip()
    inspecoes = _to_int(dados.inspecoes or 0)
    inspecao_completa = bool(
        dados.inspecao_completa
        if dados.inspecao_completa is not None
        else str(dados.status or "").strip().lower() in {"finalizada", "concluida", "concluído"}
        or bool(dados.aprovado)
    )

    _append_csv(
        INSPECOES_DADOS,
        {
            "id": proximo_id,
            "id_inspecao": id_inspecao,
            "op": dados.op or item_base.get("op", 0),
            "codigo": item_base["codigo"],
            "descricao": item_base["descricao"],
            "quantidade_programada": _to_int(dados.quantidade_programada or item_base["quantidade"]),
            "inspecao_completa": inspecao_completa,
            "quantidade_nc": quantidade_nc,
            "codigo_nc": codigo_nc,
            "observacao": observacao,
            "codigo_item": codigo_item,
            "descricao_item": descricao_item,
            "destino": destino,
            "sem_fim": sem_fim,
            "central": central,
            "inspecoes": inspecoes,
            "tensao": tensao,
        },
    )



def buscar_inspecao_dados_por_id(id_inspecao: int | str) -> dict[str, Any]:
    df_inspecoes = _ler_csv(INSPECOES)
    df_dados = _ler_csv(INSPECOES_DADOS)

    if df_inspecoes.empty or df_dados.empty:
        raise ValueError("Nenhuma inspeção encontrada.")

    alvo = str(id_inspecao).strip()
    df = df_dados.loc[df_dados["id_inspecao"].astype(str) == alvo]
    if df.empty:
        raise ValueError(f"Inspeção {id_inspecao} não encontrada.")

    row_dados = df.iloc[-1]
    row_inspecao = df_inspecoes.loc[df_inspecoes["id"].astype(str) == alvo]
    row_inspecao = row_inspecao.iloc[-1] if not row_inspecao.empty else None

    retorno = row_dados.fillna("").to_dict()
    if row_inspecao is not None:
        retorno["linha"] = str(row_inspecao.get("linha", "")).strip()
        retorno["data_hora_inicio_inspecao"] = str(row_inspecao.get("data_hora_inicio_inspecao", "")).strip()
    retorno["itens_disponiveis"] = _itens_disponiveis_por_codigo(retorno.get("codigo", 0))
    retorno["itens_inspecionados"] = itens_inspecionados_da_inspecao(alvo)
    retorno["refugos"] = refugos_da_inspecao(alvo)
    retorno["conferencias"] = df.fillna("").to_dict(orient="records")
    return retorno


async def salvar_inspecao(dados: InspecaoCreate):
    """
    Salva a inspeção principal e, quando aplicável, os itens inspecionados
    e os refugos associados.
    """

    if dados.op is None or int(dados.op) <= 0:
        raise ValueError("A OP é obrigatória para salvar a inspeção.")

    if normalize_text(dados.tipo_inspecao or "") != "manual" and _status_inicial_inspecao(dados.status):
        raise ValueError("Selecione um status diferente de Iniciado antes de salvar.")

    item_base = montar_item_base_para_salvar(dados)
    df_inspecoes = _ler_csv(INSPECOES)
    id_inspecao = _proximo_id(df_inspecoes)

    _salvar_inspecao_principal(dados, item_base, id_inspecao)

    itens_inspecionados = verificar_itens_inspecionados(dados, item_base)
    _salvar_itens_inspecionados(itens_inspecionados, id_inspecao)

    refugos = _coletar_refugos(dados, id_inspecao, item_base)
    _salvar_refugos(refugos, id_inspecao)
    _salvar_inspecao_dados(dados, item_base, id_inspecao, itens_inspecionados, refugos)

    return {
        "status": "ok",
        "id_inspecao": id_inspecao,
        "op": item_base["op"],
        "codigo": item_base["codigo"],
        "descricao": item_base["descricao"],
        "quantidade": item_base["quantidade"],
        "itens_ja_inspecionados": itens_inspecionados_da_op(item_base["op"]),
        "itens_inspecionados": len(itens_inspecionados),
        "refugos": len(refugos),
    }

def _resumir_dados_inspecao(df_dados: pd.DataFrame, id_inspecao: int | str) -> dict[str, Any]:
    if df_dados.empty or "id_inspecao" not in df_dados.columns:
        return {}

    alvo = str(id_inspecao).strip()
    df = df_dados.loc[df_dados["id_inspecao"].astype(str) == alvo]
    if df.empty:
        return {}

    base = df.iloc[0].fillna("").to_dict()

    quantidade_nc = 0
    codigos_nc: list[str] = []
    observacoes: list[str] = []
    for _, row in df.iterrows():
        quantidade_nc += _to_int(row.get("quantidade_nc", 0))
        codigo_nc = str(row.get("codigo_nc", "")).strip()
        observacao = str(row.get("observacao", "")).strip()
        if codigo_nc and codigo_nc not in codigos_nc:
            codigos_nc.append(codigo_nc)
        if observacao and observacao not in observacoes:
            observacoes.append(observacao)

    base["quantidade_nc"] = quantidade_nc
    base["codigo_nc"] = ", ".join(codigos_nc)
    base["observacao"] = " | ".join(observacoes) if observacoes else str(base.get("observacao", "")).strip()
    return base


def _salvar_inspecao_dados(
    dados: InspecaoCreate,
    item_base: dict[str, Any],
    id_inspecao: int,
    itens_inspecionados: list[ItemInspecionado],
    refugos: list[RefugoInspecao],
) -> None:
    df_existente = _ler_csv(INSPECOES_DADOS)
    proximo_id = _proximo_id(df_existente)

    itens_base = list(itens_inspecionados) or [
        ItemInspecionado(
            id=0,
            id_inspecao=id_inspecao,
            codigo=_to_int(dados.codigo_item or item_base.get("codigo", 0)),
            descricao=str(dados.descricao_item or item_base.get("descricao", "")).strip(),
            campo="item_principal",
        )
    ]

    refugos_por_item = {
        _chave_item_inspecionado(refugo.codigo, refugo.descricao, refugo.campo or ""): refugo
        for refugo in refugos
    }

    destino = str(dados.destino or "").strip()
    sem_fim = str(dados.sem_fim or item_base.get("sem_fim") or "").strip()
    central = str(dados.central or item_base.get("central") or "").strip()
    tensao = str(dados.tensao or item_base.get("tensao") or "").strip()
    inspecoes = _to_int(dados.inspecoes or 0)
    inspecao_completa = bool(
        dados.inspecao_completa
        if dados.inspecao_completa is not None
        else str(dados.status or "").strip().lower() in {"finalizada", "concluida", "concluÃ­do"}
        or bool(dados.aprovado)
    )

    for indice, item in enumerate(itens_base, start=1):
        refugo = refugos_por_item.get(
            _chave_item_inspecionado(item.codigo, item.descricao, item.campo or "")
        )

        _append_csv(
            INSPECOES_DADOS,
            {
                "id": proximo_id,
                "id_inspecao": id_inspecao,
                "op": dados.op or item_base.get("op", 0),
                "codigo": item_base["codigo"],
                "descricao": item_base["descricao"],
                "quantidade_programada": _to_int(dados.quantidade_programada or item_base["quantidade"]),
                "inspecao_completa": inspecao_completa,
                "quantidade_nc": _to_int(refugo.quantidade if refugo else 0),
                "codigo_nc": str(refugo.codigo_nc if refugo else "").strip(),
                "observacao": str(refugo.observacao if refugo else "").strip(),
                "codigo_item": item.codigo,
                "descricao_item": item.descricao,
                "item_campo": item.campo or "",
                "destino": destino,
                "sem_fim": sem_fim,
                "central": central,
                "inspecoes": inspecoes,
                "tensao": tensao,
            },
        )
        proximo_id += 1


def listar_inspecoes_do_dia():
    df_inspecoes = _ler_csv(INSPECOES)
    df_dados = _ler_csv(INSPECOES_DADOS)
    df_linha = _ler_csv(SEQUENCIAMENTO)

    if df_inspecoes.empty or "data_hora_fim_inspecao" not in df_inspecoes.columns:
        return []

    df_inspecoes["data_hora_fim_inspecao"] = pd.to_datetime(
        df_inspecoes["data_hora_fim_inspecao"],
        errors="coerce",
    )

    hoje = datetime.now().date()
    fim_inspecao = df_inspecoes.loc[df_inspecoes["data_hora_fim_inspecao"].dt.date == hoje].copy()
    if fim_inspecao.empty:
        return []

    if "op" not in fim_inspecao.columns:
        return []

    registros: list[dict[str, Any]] = []
    fim_inspecao = fim_inspecao.sort_values(by="data_hora_fim_inspecao", ascending=False)

    for _, row in fim_inspecao.iterrows():
        id_inspecao = _to_int(row.get("id", 0))
        op = _to_int(row.get("op", 0))
        linha = ""

        if not df_linha.empty and "op" in df_linha.columns and "linha" in df_linha.columns:
            filtro_linha = df_linha.loc[df_linha["op"].astype(str) == str(op), "linha"]
            if not filtro_linha.empty:
                linha = str(filtro_linha.iloc[-1]).strip()

        resumo = _resumir_dados_inspecao(df_dados, id_inspecao)
        quantidade_programada = _to_int(resumo.get("quantidade_programada", row.get("quantidade", 0)))
        codigo = _to_int(resumo.get("codigo", row.get("codigo", 0)))
        descricao = str(resumo.get("descricao", row.get("descricao", ""))).strip()

        registros.append(
            {
                "id_inspecao": id_inspecao,
                "op": op,
                "linha": linha,
                "hora": row["data_hora_fim_inspecao"].strftime("%H:%M")
                if pd.notna(row.get("data_hora_fim_inspecao"))
                else "",
                "codigo": codigo,
                "descricao": descricao,
                "quantidade_programada": quantidade_programada,
                "status": str(row.get("status", "")).strip() or "Em andamento",
                "codigo_item": _to_int(resumo.get("codigo_item", row.get("codigo", 0))),
                "descricao_item": str(resumo.get("descricao_item", "")).strip(),
                "destino": str(resumo.get("destino", "")).strip(),
                "observacao": str(resumo.get("observacao", row.get("observacao", ""))).strip(),
                "url_reinspecao": (
                    f"/qualidade/inspecoes/op/{op}?id_inspecao={id_inspecao}"
                ),
                "itens_inspecionados": itens_inspecionados_da_inspecao(id_inspecao),
                "refugos": refugos_da_inspecao(id_inspecao),
            }
        )

    return registros

def buscar_inspecao_dados_por_id(id_inspecao: int | str) -> dict[str, Any]:
    df_inspecoes = _ler_csv(INSPECOES)
    df_dados = _ler_csv(INSPECOES_DADOS)

    if df_inspecoes.empty or df_dados.empty:
        df_dados = pd.DataFrame()

    alvo = str(id_inspecao).strip()
    resumo = _resumir_dados_inspecao(df_dados, alvo)
    row_inspecao = df_inspecoes.loc[df_inspecoes["id"].astype(str) == alvo]
    row_inspecao = row_inspecao.iloc[-1] if not row_inspecao.empty else None

    if not resumo and row_inspecao is not None:
        resumo = row_inspecao.fillna("").to_dict()
        resumo["id_inspecao"] = _to_int(row_inspecao.get("id", id_inspecao))
        resumo["op"] = _to_int(row_inspecao.get("op", 0))
        resumo["codigo"] = _to_int(row_inspecao.get("codigo", 0))
        resumo["descricao"] = str(row_inspecao.get("descricao", "")).strip()
        resumo["quantidade_programada"] = _to_int(row_inspecao.get("quantidade", 0))
        resumo["inspecao_completa"] = str(row_inspecao.get("status", "")).strip().lower() in {
            "finalizada",
            "concluida",
            "concluído",
        }
        resumo["quantidade_nc"] = 0
        resumo["codigo_nc"] = ""
        resumo["observacao"] = ""
        resumo["codigo_item"] = _to_int(row_inspecao.get("codigo", 0))
        resumo["descricao_item"] = str(row_inspecao.get("descricao", "")).strip()

    if not resumo:
        raise ValueError(f"Inspeção {id_inspecao} não encontrada.")

    retorno = resumo
    if row_inspecao is not None:
        retorno["linha"] = str(row_inspecao.get("linha", "")).strip()
        retorno["data_hora_inicio_inspecao"] = str(row_inspecao.get("data_hora_inicio_inspecao", "")).strip()
    retorno["itens_disponiveis"] = _itens_disponiveis_por_codigo(retorno.get("codigo", 0))
    retorno["itens_inspecionados"] = itens_inspecionados_da_inspecao(alvo)
    retorno["refugos"] = refugos_da_inspecao(alvo)
    return retorno


def _status_inicial_inspecao(status: str) -> bool:
    return normalize_text(status) in {"iniciado", "em analise"}


if __name__ == "__main__":
    """print(refugos_da_inspecao(32))

    exemplo = InspecaoCreate(
        op=96663,
        codigo=0,
        descricao="",
        quantidade=0,
        data_hora_inicio_inspecao=datetime.now(),
        data_hora_fim_inspecao=datetime.now(),
        possui_op=True,
        qtd_etiquetas=1,
        status="teste",
        conformidade=True,
        refugo=False,
        aprovado=True,
    )

    print(asyncio.run(salvar_inspecao(exemplo)))
    """

    print(listar_inspecoes_do_dia())
