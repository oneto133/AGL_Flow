import pandas as pd
from datetime import timedelta

CAMINHO_LINHAS = r"dados/csv/config_linhas.csv"

def _alterar_nome_linha(atual, novo) -> dict[str, str]:
    """Faz a alteração de nome de linha,
    as vezes um operador sai de uma linha ou a linha muda de nome,
    então é necessário fazer a troca de nome para melhorar o norte."""

    df = pd.read_csv(CAMINHO_LINHAS, encoding="utf-8")

    df.loc[df["celula_linha"] == atual, "celula_linha"] = novo

    df.to_csv(CAMINHO_LINHAS, index=False, encoding="utf-8")

    return {"status": "sucesso", "mensagem": f"usuário '{atual}' alterado com sucesso para {novo}"}

def _consultar_nome_linhas() -> dict:

    df = pd.read_csv(CAMINHO_LINHAS, encoding="utf-8")

    return df['celula_linha'].unique().tolist()

def adicionar_horas_uteis(data_inicio, horas_para_adicionar):
    """
    Soma as horas necessárias avançando minuto a minuto, 
    respeitando o expediente comercial da empresa.
    """
    data_inicio = proximo_horario_util(data_inicio)

    if horas_para_adicionar <= 0:
        return data_inicio

    minutos_restantes = int(horas_para_adicionar * 60)
    data_atual = data_inicio

    while minutos_restantes > 0:
        data_atual += timedelta(minutes=1)
        w = data_atual.weekday()  # 0=Segunda, 3=Quinta, 4=Sexta, 5=Sábado, 6=Domingo
        h = data_atual.hour

        # Verifica se o minuto atual está dentro do horário útil comercial
        if 0 <= w <= 3:  # Segunda a Quinta
            if 7 <= h < 17:
                minutos_restantes -= 1
        elif w == 4:     # Sexta
            if 7 <= h < 16:
                minutos_restantes -= 1
        # Sábados e Domingos são ignorados (o relógio corre sem descontar os minutos restantes)

    return data_atual

def proximo_horario_util(data):
    while True:
        w = data.weekday()

        # Segunda a quinta
        if w <= 3:
            if data.hour < 7:
                return data.replace(hour=7, minute=0, second=0, microsecond=0)

            if data.hour >= 17:
                data = (data + timedelta(days=1)).replace(
                    hour=7, minute=0, second=0, microsecond=0
                )
                continue

            return data

        # Sexta
        elif w == 4:
            if data.hour < 7:
                return data.replace(hour=7, minute=0, second=0, microsecond=0)

            if data.hour >= 16:
                data = (data + timedelta(days=3)).replace(
                    hour=7, minute=0, second=0, microsecond=0
                )
                continue

            return data

        # Sábado
        elif w == 5:
            data = (data + timedelta(days=2)).replace(
                hour=7, minute=0, second=0, microsecond=0
            )

        # Domingo
        else:
            data = (data + timedelta(days=1)).replace(
                hour=7, minute=0, second=0, microsecond=0
            )

def calcular_horas_uteis(inicio, fim):
    if pd.isna(inicio) or pd.isna(fim) or inicio >= fim:
        return 0.0
    minutos = pd.date_range(start=inicio, end=fim, freq='min')
    dias_semana = minutos.dayofweek
    horas = minutos.hour
    seg_qui_util = (dias_semana >= 0) & (dias_semana <= 3) & (horas >= 7) & (horas < 17)
    sexta_util = (dias_semana == 4) & (horas >= 7) & (horas < 16)
    minutos_uteis = np.sum(seg_qui_util | sexta_util)
    return round(minutos_uteis / 60.0, 2)
    
if __name__ == "__main__":
    _alterar_nome_linha("teste", "teste1")