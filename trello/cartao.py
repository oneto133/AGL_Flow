import os
import pandas as pd
import csv
import textwrap

caminho_origem = {
    "BASE_DESLIZANTES_XLSX": r"xlsx\base_de_dados.xlsx",
    "BASE_NEWBV_XLSX": r"xlsx\new_bv.xlsx",
    "BASE_BASCULANTES_XLSX": r"xlsx\basculantes.xlsx",
    "BASE_PIVOTANTE_XLSX": r"xlsx\pivotante.xlsx"
}

caminho_destino = {
    "BASE_DESLIZANTES_CSV": r"csv\base_de_dados.csv",
    "BASE_NEWBV_CSV": r"csv\new_bv.csv",
    "BASE_BASCULANTES_CSV": r"csv\basculantes.csv",
    "BASE_PIVOTANTE_CSV": r"csv\pivotante.csv"
}

def cartao_dz(
        codigo,
        descricao,
        qtd,
        op,
        central,
        base,
        engrenagem,
        estator_e_sem_fim,
        capacitor,
        tampa,
        cilindro,
        controle
) -> dict:
    
    conteudo_cartao_dz = {
        "titulo": f"{descricao} - {qtd} UND - (OP{op})",
        "conteudo": (
f"""CÓDIGO DO PRODUTO: {codigo}

PRODUTO: {descricao}

ORDEM DE PRODUÇÃO: {op}
QUANTIDADE: {qtd} UND

-------------------------

ESPECIFICAÇÕES

CENTRAL: {central}
BASE: {base}
ENGRENAGEM: {engrenagem}
ESTATOR E SEM FIM: {estator_e_sem_fim}
CAPACITOR: {capacitor}
TAMPA: {tampa}
CILINDRO: {cilindro}
CONTROLE: {controle}
"""
        )
    }
    return conteudo_cartao_dz

def cartao_newbv(
        codigo,
        descricao,
        qtd,
        op,
        central,
        engrenagem,
        estator_e_sem_fim,
        capacitor,
        rolamento) -> dict:
    conteudo_cartao_newbv = {
        "titulo": f"{descricao} - {qtd} UND - (OP{op})",
        "conteudo": (
f"""CÓDIGO DO PRODUTO: {codigo}

PRODUTO: {descricao}

ORDEM DE PRODUÇÃO: {op}
QUANTIDADE: {qtd} UND

-------------------------
ESPECIFICAÇÕES
CENTRAL: {central}
ENGRENAGEM: {engrenagem}
ESTATOR E SEM FIM: {estator_e_sem_fim}
CAPACITOR: {capacitor}
ROLAMENTO: {rolamento}
"""
        )
    }
    return conteudo_cartao_newbv

def cartao_basculante(
        codigo,
        descricao,
        qtd,
        op,
        central,
        carenagem,
        estator_e_sem_fim,
        capacitor) -> dict:
    conteudo_cartao_basculante = {
        "titulo": f"{descricao} - {qtd} UND - (OP{op})",
        "conteudo": (
f"""CÓDIGO DO PRODUTO: {codigo}

PRODUTO: {descricao}

ORDEM DE PRODUÇÃO: {op}
QUANTIDADE: {qtd} UND

-------------------------
ESPECIFICAÇÕES
CENTRAL: {central}
CARENAGEM: {carenagem}
ESTATOR E SEM FIM: {estator_e_sem_fim}
CAPACITOR: {capacitor}
"""
        )
    }
    return conteudo_cartao_basculante

def cartao_pivotante(
        codigo,
        descricao,
        qtd,
        op,
        central,
        carenagem,
        estator_e_sem_fim,
        capacitor,
        kit_de_instalação) -> dict:

    conteudo_cartao_pivotante = {
        "titulo": f"{descricao} - {qtd} UND - (OP{op})",
        "conteudo": (
f"""CÓDIGO DO PRODUTO: {codigo}

PRODUTO: {descricao}

ORDEM DE PRODUÇÃO: {op}
QUANTIDADE: {qtd} UND

-----------------------------

ESPECIFICAÇÕES

CENTRAL: {central}
CARENAGEM: {carenagem}
ESTATOR E SEM FIM: {estator_e_sem_fim}
CAPACITOR: {capacitor}
KIT DE INSTALAÇÃO: {kit_de_instalação}
"""
        )
    }
    return conteudo_cartao_pivotante


def atualizar_base_de_dados():
    if not os.path.exists("csv"):
        os.makedirs("csv")

    # Adicionado a base pivotante nas tarefas de atualização automática
    tarefas = [
        (caminho_origem["BASE_DESLIZANTES_XLSX"], caminho_destino["BASE_DESLIZANTES_CSV"]),
        (caminho_origem["BASE_NEWBV_XLSX"], caminho_destino["BASE_NEWBV_CSV"]),
        (caminho_origem["BASE_BASCULANTES_XLSX"], caminho_destino["BASE_BASCULANTES_CSV"]),
        (caminho_origem["BASE_PIVOTANTE_XLSX"], caminho_destino["BASE_PIVOTANTE_CSV"])
    ]

    for origem, destino in tarefas:
        try:
            if not os.path.exists(origem):
                print(f"Aviso: Planilha de origem não encontrada: {origem}")
                continue

            print(f"Atualizando: {origem} -> {destino}")
            para_csv = pd.read_excel(origem, engine="openpyxl")
            
            primeira_coluna = para_csv.columns[0]
            para_csv[primeira_coluna] = para_csv[primeira_coluna].astype("Int64")

            para_csv.to_csv(destino, index=False, encoding='utf-8')
            print(f"Sucesso ao atualizar {destino}")
        except Exception as e:
            print(f"Erro ao atualizar o arquivo {origem}: {str(e)}")

def ler_base_de_dados(codigo, op=None, qtd=None) -> dict:
    try:
        codigo_int = int(codigo)
    except (ValueError, TypeError):
        return {"erro": "O código do produto deve ser um número inteiro."}

    # 1. Procura na base de Deslizantes
    if os.path.exists(caminho_destino["BASE_DESLIZANTES_CSV"]):
        df_dz = pd.read_csv(caminho_destino["BASE_DESLIZANTES_CSV"], encoding='utf-8')
        retorno = df_dz[df_dz["CÓD DO PRODUTO"] == codigo_int]
        if not retorno.empty:
            lista = retorno.values[0].tolist()
            return cartao_dz(
                codigo=str(lista[0])[0:7], descricao=str(lista[1]), qtd=qtd, op=op,
                central=lista[2], base=lista[3], engrenagem=lista[4], estator_e_sem_fim=lista[5],
                capacitor=lista[6], tampa=lista[7], cilindro=lista[8], controle=lista[9]
            )

    # 2. Procura na base de New BV
    if os.path.exists(caminho_destino["BASE_NEWBV_CSV"]):
        df_bv = pd.read_csv(caminho_destino["BASE_NEWBV_CSV"], encoding='utf-8')
        retorno = df_bv[df_bv["CÓD DO PRODUTO"] == codigo_int]
        if not retorno.empty:
            lista = retorno.values[0].tolist()
            return cartao_newbv(
                codigo=str(lista[0])[0:7], descricao=str(lista[1]), qtd=qtd, op=op,
                central=lista[2], engrenagem=lista[3], estator_e_sem_fim=lista[4],
                capacitor=lista[5], rolamento=lista[6]
            )

    # 3. Procura na base de Basculantes
    if os.path.exists(caminho_destino["BASE_BASCULANTES_CSV"]):
        df_basc = pd.read_csv(caminho_destino["BASE_BASCULANTES_CSV"], encoding='utf-8')
        retorno = df_basc[df_basc["CÓD DO PRODUTO"] == codigo_int]
        if not retorno.empty:
            lista = retorno.values[0].tolist()
            return cartao_basculante(
                codigo=str(lista[0])[0:7], descricao=str(lista[1]), qtd=qtd, op=op,
                central=lista[2], carenagem=lista[3], estator_e_sem_fim=lista[4], capacitor=lista[5]
            )

    # 4. Procura na base de Pivotantes
    if os.path.exists(caminho_destino["BASE_PIVOTANTE_CSV"]):
        df_piv = pd.read_csv(caminho_destino["BASE_PIVOTANTE_CSV"], encoding='utf-8')
        retorno = df_piv[df_piv["CÓD DO PRODUTO"] == codigo_int]
        if not retorno.empty:
            lista = retorno.values[0].tolist()
            return cartao_pivotante(
                codigo=str(lista[0])[0:7], descricao=str(lista[1]), qtd=qtd, op=op,
                central=lista[2], carenagem=lista[3], estator_e_sem_fim=lista[4], 
                capacitor=lista[5], kit_de_instalação=lista[6]
            )

    return {"erro": "Produto não localizado em nenhuma base."}


def produto(codigo):
    try:
        codigo_int = int(codigo)
    except (ValueError, TypeError):
        return None

    # Grupo 1: Apenas Deslizantes
    celulas_dz = [
        "Célula 6 - MARCIELE", 
        "Célula 2 - JULLIE", 
        "Célula 5 - CRISTIANE", 
        "Célula 3 - BIANCA"
    ]

    # Grupo 2: Apenas as outras linhas (Basculante, New BV e Pivotantes)
    celulas_outros = [
        "NEW BV",
        "BASCULANTE", 
        "Célula 1 - PIVOTANTE - ADRIANO", 
        "Célula 2 - PIVOTANTE - CARLOS", 
        "Célula 3 - PIVOTANTE - ROLF"
    ]

    # 1. Busca na base de Deslizantes -> Se achar, exibe APENAS as células DZ
    if os.path.exists(caminho_destino["BASE_DESLIZANTES_CSV"]):
        df = pd.read_csv(caminho_destino["BASE_DESLIZANTES_CSV"], encoding='utf-8')
        retorno = df[df["CÓD DO PRODUTO"] == codigo_int]
        if not retorno.empty:
            return {"descricao": str(retorno.values[0][1]), "opcoes": celulas_dz}

    # 2. Busca New BV -> Se achar, exibe APENAS as outras linhas
    if os.path.exists(caminho_destino["BASE_NEWBV_CSV"]):
        df = pd.read_csv(caminho_destino["BASE_NEWBV_CSV"], encoding='utf-8')
        retorno = df[df["CÓD DO PRODUTO"] == codigo_int]
        if not retorno.empty:
            return {"descricao": str(retorno.values[0][1]), "opcoes": celulas_outros}

    # 3. Busca Basculantes -> Se achar, exibe APENAS as outras linhas
    if os.path.exists(caminho_destino["BASE_BASCULANTES_CSV"]):
        df = pd.read_csv(caminho_destino["BASE_BASCULANTES_CSV"], encoding='utf-8')
        retorno = df[df["CÓD DO PRODUTO"] == codigo_int]
        if not retorno.empty:
            return {"descricao": str(retorno.values[0][1]), "opcoes": celulas_outros}

    # 4. Busca Pivotantes -> Se achar, exibe APENAS as outras linhas
    if os.path.exists(caminho_destino["BASE_PIVOTANTE_CSV"]):
        df = pd.read_csv(caminho_destino["BASE_PIVOTANTE_CSV"], encoding='utf-8')
        retorno = df[df["CÓD DO PRODUTO"] == codigo_int]
        if not retorno.empty:
            return {"descricao": str(retorno.values[0][1]), "opcoes": celulas_outros}

    return None



if __name__ == "__main__":
    atualizar_base_de_dados()
