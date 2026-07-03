import pandas as pd
import numpy as np

def calcular_horas_uteis(inicio, fim):
    """
    Calcula as horas úteis entre duas datas considerando:
    Segunda a Quinta: 07:00 às 17:00
    Sexta: 07:00 às 16:00
    """
    if pd.isna(inicio) or pd.isna(fim) or inicio >= fim:
        return 0.0

    minutos = pd.date_range(start=inicio, end=fim, freq='min')
    
    dias_semana = minutos.dayofweek
    horas = minutos.hour
    
    seg_qui_util = (dias_semana >= 0) & (dias_semana <= 3) & (horas >= 7) & (horas < 17)
    sexta_util = (dias_semana == 4) & (horas >= 7) & (horas < 16)
    
    minutos_uteis = np.sum(seg_qui_util | sexta_util)
    
    return round(minutos_uteis / 60.0, 2)

def calcular_ultima_hora(id_cartao):
    caminho = r"dados/csv/sequenciamento.csv"
    
    df = pd.read_csv(caminho, encoding="utf-8", engine="python")

    dados_cartao = df[df["id_cartao"] == id_cartao]
    if dados_cartao.empty:
        print(f"Aviso: Cartão {id_cartao} não encontrado.")
        return None
        
    linha_atual = dados_cartao["linha"].values[0]

    # SOLUÇÃO: Criamos cópias convertidas para datetime para fazer cálculos,
    # deixando as colunas originais do dataframe intactas na hora de salvar!
    datas_finalizacao_dt = pd.to_datetime(df["data_hora_finalizacao"], errors="coerce")
    datas_sequenciamento_dt = pd.to_datetime(df["data_hora_sequenciamento"], errors="coerce")

    # Captura os pontos temporais direto da série tratada
    fim_op_atual = datas_finalizacao_dt[df["id_cartao"] == id_cartao].values[0]
    sequenciamento_atual = datas_sequenciamento_dt[df["id_cartao"] == id_cartao].values[0]

    # SOLUÇÃO DO COMPORTAMENTO: Validação correta para tipos datetime64 do numpy
    if not pd.isna(fim_op_atual):
        referencia_tempo = fim_op_atual
    else:
        referencia_tempo = sequenciamento_atual

    # Monta o histórico usando as datas convertidas temporárias
    historico_indices = (df["linha"] == linha_atual) & (df["status"] == "Concluído") & (datas_finalizacao_dt.notna())
    historico_anterior = datas_finalizacao_dt[historico_indices & (datas_finalizacao_dt < referencia_tempo)]

    if not historico_anterior.empty:
        hora_inicio_fila = historico_anterior.max()
    else:
        hora_inicio_fila = None

    # Grava as informações de fila na tabela de strings originais sem alterá-las
    # Se hora_inicio_fila existir, salvamos formatado como texto padrão do seu CSV
    if hora_inicio_fila is not None:
        df.loc[df["id_cartao"] == id_cartao, "hora_inicio_fila"] = pd.Timestamp(hora_inicio_fila).strftime("%Y-%m-%d %H:%M:%S")
    else:
        df.loc[df["id_cartao"] == id_cartao, "hora_inicio_fila"] = None

    inicio_ts = pd.to_datetime(hora_inicio_fila)
    fim_ts = pd.to_datetime(referencia_tempo)

    # Executa o cálculo matemático
    tempo_total_uteis = calcular_horas_uteis(inicio_ts, fim_ts)

    # Escreve o tempo total decimal
    df.loc[df["id_cartao"] == id_cartao, "tempo_total_fila"] = tempo_total_uteis

    # Salva mantendo o formato string original do seu CSV intacto
    df.to_csv(caminho, index=False, encoding="utf-8")

    return hora_inicio_fila

if __name__ == "__main__":
    id_cartao = "6a476acc2dc270e154621d35"
    ultima_hora = calcular_ultima_hora(id_cartao)
    print(f"Última hora de início da fila para o cartão {id_cartao}: {ultima_hora}")
