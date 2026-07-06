import pandas as pd
from config import APP_HOME, CSV_DIR

# Caminhos dos arquivos de entrada
relatorio_diario_normalizado = APP_HOME / "csv" / "relatorio_diario.csv"
lista_tecnica_motores = CSV_DIR / "lt_tabela_geral.csv"

# Caminhos dos arquivos de saída (Os dois relatórios)
csv_saida_analise = CSV_DIR / "explosao_mp.csv"
csv_saida_auditoria = CSV_DIR / "auditoria_lista_tecnica.csv"

def carregar_e_preparar_dados():
    """Função interna para carregar e cruzar os dados evitando repetição de código"""
    # 1. Carrega e trata a Lista Técnica
    lt = pd.read_csv(lista_tecnica_motores, encoding="latin1")
    lt.columns = ["Produto_Pai", "Desc_Pai", "Codigo MP", "Descricao MP", "Consumo_Unitario"]
    lt["Consumo_Unitario"] = lt["Consumo_Unitario"].astype(str).str.replace(",", ".").astype(float)

    # 2. Carrega e trata o Relatório de Vendas
    df_vendas = pd.read_csv(relatorio_diario_normalizado, encoding="latin1")
    colunas_vendas = {
        "Unnamed: 1": "Produto_Pai",
        "Unnamed: 5": "Atraso",
        "Unnamed: 6": "Hoje",
        "Unnamed: 7": "Semana1",
        "Unnamed: 8": "Semana2",
        "Unnamed: 9": "Semana3",
        "Unnamed: 10": "Semana4",
        "Unnamed: 11": "Proxima",
        "Unnamed: 12": "Seguinte",
        "Unnamed: 13": "Total"
    }
    df_vendas = df_vendas[list(colunas_vendas.keys())].rename(columns=colunas_vendas)
    
    # Limpeza de strings para o cruzamento perfeito
    df_vendas["Produto_Pai"] = df_vendas["Produto_Pai"].astype(str).str.strip()
    lt["Produto_Pai"] = lt["Produto_Pai"].astype(str).str.strip()

    # 3. Cruza as tabelas e faz o cálculo da explosão (Venda * Consumo)
    df_cruzado = pd.merge(df_vendas, lt, on="Produto_Pai", how="inner")
    colunas_prazos = ["Atraso", "Hoje", "Semana1", "Semana2", "Semana3", "Semana4", "Proxima", "Seguinte", "Total"]
    
    for coluna in colunas_prazos:
        df_cruzado[coluna] = pd.to_numeric(df_cruzado[coluna], errors="coerce").fillna(0)
        df_cruzado[coluna] = df_cruzado[coluna] * df_cruzado["Consumo_Unitario"]
        
    return df_cruzado, colunas_prazos


def gerar_csv_analise_materia_prima(df_base, colunas_prazos):
    """Gera o CSV consolidado por Matéria-Prima (Seu relatório original)"""
    df_final = df_base.groupby(["Codigo MP", "Descricao MP"]).agg({
        "Atraso": "sum",
        "Hoje": "sum",
        "Semana1": "sum",
        "Semana2": "sum",
        "Semana3": "sum",
        "Semana4": "sum",
        "Proxima": "sum",
        "Seguinte": "sum",
        "Total": "sum"
    }).reset_index()

    df_final[colunas_prazos] = abs(df_final[colunas_prazos].round(2))
    df_final.to_csv(csv_saida_analise, index=False, sep=";", decimal=",", encoding="latin1")
    print(f"✓ Sucesso! Análise consolidada gerada em: {csv_saida_analise}")


def gerar_csv_auditoria_lista_tecnica(df_base, colunas_prazos):
    """Gera o CSV aberto por Produto Pai para checagem e alteração de consumos"""
    colunas_finais = [
        "Produto_Pai", "Desc_Pai", "Codigo MP", "Descricao MP", "Consumo_Unitario",
        "Atraso", "Hoje", "Semana1", "Semana2", "Semana3", "Semana4", "Proxima", "Seguinte", "Total"
    ]
    df_auditoria = df_base[colunas_finais].copy()
    df_auditoria[colunas_prazos] = abs(df_auditoria[colunas_prazos].round(2))
    
    df_auditoria.to_csv(csv_saida_auditoria, index=False, sep=";", decimal=",", encoding="latin1")
    print(f"✓ Sucesso! Relatório de auditoria gerado em: {csv_saida_auditoria}")

if __name__ == "__main__":
    df_calculado, prazos = carregar_e_preparar_dados()
    
    gerar_csv_analise_materia_prima(df_calculado, prazos)
    gerar_csv_auditoria_lista_tecnica(df_calculado, prazos)
