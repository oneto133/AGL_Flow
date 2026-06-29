import os
from datetime import datetime
from pathlib import Path
import pandas as pd
from copiar_relatorio import main as copiar
from extrair_csvs import main as extracao
from atualizar_lista_tecnica import main as atualizarLT
from reposicao_e_diversos import main as relatorioDiversos
from time import sleep

def main() -> None:

    """
    Checa se a ultima atualização do relatório já foi extraido de acordo com a ultima atualização na rede

    
    """


    RELATORIO = Path(__file__).resolve().parent
    APP = RELATORIO.parent
    PAI = APP.parent
    CSV = PAI / "dados/csv"

    while True:
        caminho = r"Z:\PCP\2.2- Relatório Semanal - NOVO.xlsb"

        timestamp = os.path.getmtime(caminho) # verifica ultima vez que foi salvo

        modificação = datetime.fromtimestamp(timestamp)

        log_caminho = CSV / "log_atualizacao.csv"
        
        df = pd.read_csv("dados/csv/log_atualizacao.csv", nrows=1)

        data_hora = df.columns[0]
        if str(modificação) != str(data_hora): # se a ultima modificação ainda não doi extraida, então ele extrai
            print(data_hora)
            executar()
            registrar_log(PAI, modificação=modificação)
            print("Procurando...")
        else:
             print("procurando")
             sleep(60)


def registrar_log(caminho, modificação) -> None:
        with open (caminho / "csv/log_atualizacao.csv", "w") as file: #salva a aultima alteração e procura por novas
            file.write(f"{modificação}")
            print(f"última atualização em {modificação}")


def executar() -> str:

    """
    Copia relatório de vendas para um arquivo temporário

    extrai para csv

    atualiza as listas técnicas de acordo com as ultimas atualizações

    filtra o relatório de vendas para exibir apenas vendas do setor
    """


    copiar().relatorio_vendas()
    extracao()
    atualizarLT()
    relatorioDiversos().filtro()

    print("Dados atualizados")

            

if __name__ == "__main__":
    main()