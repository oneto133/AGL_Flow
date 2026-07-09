import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from config.paths import CSV_DIR
import asyncio, csv

caminho_metricas = CSV_DIR / "metricas.csv"

def calcular_inclinacao(grupo):
    if len(grupo) < 2:
        return 0.0
    
    y = grupo.values
    x = np.arange(len(y))
    inclicanao, _ = np.polyfit(x, y, 1)

    return inclicanao

async def atualizar_metricas(df):
    df["data_hora_sequenciamento"] = pd.to_datetime(df["data_hora_sequenciamento"])
    df["quantidade"] = pd.to_numeric(df["quantidade"], errors="coerce").fillna(0)

    df = df.sort_values("data_hora_sequenciamento")

    sete_dias= datetime.now() - timedelta(7)
    filtro_status = df["status"] == "Concluído"
    filtro_data = df["data_hora_sequenciamento"] >= sete_dias

    ultima_semana = df[filtro_status & filtro_data]

    concluido = df[filtro_status]
    
    metricas = (
        concluido.groupby(["codigo_produto", "descricao_produto"])
        .size()
        .reset_index(name="total_sequencias")
    )

    metricas_semanal = (
        ultima_semana.groupby(["codigo_produto", "descricao_produto"])
        .size()
        .reset_index(name="total_semana")
    )

    metricas_mediana = (
        concluido.groupby(["codigo_produto", "descricao_produto"])["quantidade"]
        .median()
        .reset_index(name="quantidade_mediana")
    )

    stats_variacao = concluido.groupby(["codigo_produto", "descricao_produto"])["quantidade"].agg(["mean", "std"])
    stats_variacao["coeficiente_variacao"] = (stats_variacao["std"] / stats_variacao["mean"]).fillna(0)
    metricas_variacao = stats_variacao.reset_index()[["codigo_produto", "descricao_produto", "coeficiente_variacao"]]

    # Inclinação da tendência de quantidade por produto
    metricas_inclinacao = (
        concluido.groupby(["codigo_produto", "descricao_produto"])["quantidade"]
        .apply(calcular_inclinacao)
        .reset_index(name="inclinacao_tendencia")
    )

    # Média Móvel (Exemplo das últimas 3 ordens de produção do produto específico)
    # Como a média móvel gera um resultado por linha, pegamos a última média calculada de cada item
    concluido_copia = concluido.copy()
    concluido_copia["media_movel"] = concluido_copia.groupby(["codigo_produto"])["quantidade"].rolling(window=3, min_periods=1).mean().reset_index(0, drop=True)
    metricas_media_movel = concluido_copia.groupby(["codigo_produto", "descricao_produto"])["media_movel"].last().reset_index(name="ultima_media_movel")

    # --- UNIFICAR TODAS AS TABELAS (MERGES) ---
    # Juntando o total geral com o total da semana
    metricas_finais = pd.merge(metricas, metricas_semanal, on=["codigo_produto", "descricao_produto"], how="left")
    metricas_finais["total_semana"] = metricas_finais["total_semana"].fillna(0).astype(int)

    # Adicionando as novas métricas estatísticas na tabela final
    metricas_finais = pd.merge(metricas_finais, metricas_mediana, on=["codigo_produto", "descricao_produto"], how="left")
    metricas_finais = pd.merge(metricas_finais, metricas_variacao, on=["codigo_produto", "descricao_produto"], how="left")
    metricas_finais = pd.merge(metricas_finais, metricas_inclinacao, on=["codigo_produto", "descricao_produto"], how="left")
    metricas_finais = pd.merge(metricas_finais, metricas_media_movel, on=["codigo_produto", "descricao_produto"], how="left")

    # Forçar tipos inteiros onde se aplica
    metricas_finais["total_sequencias"] = metricas_finais["total_sequencias"].astype(int)



    metricas_finais.to_csv(caminho_metricas, index=False, encoding="utf-8", sep=";", decimal=",", quoting=csv.QUOTE_NONNUMERIC)

    codigo, descricao = concluido["codigo_produto"], concluido["descricao_produto"]

    print("Base atualizada com sucesso")


if __name__ == "__main__":
    caminho_sequenciamento = r"dados\csv\sequenciamento.csv"
    df = pd.read_csv(caminho_sequenciamento, encoding="utf-8")
    asyncio.run(atualizar_metricas(df))