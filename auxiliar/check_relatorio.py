import os
from datetime import datetime
from pathlib import Path
import pandas as pd
from .copiar_relatorio import main as copiar
from .extrair_csvs import main as extracao
from .atualizar_lista_tecnica import main as atualizarLT
from .reposicao_e_diversos import main as relatorioDiversos
from time import sleep
from utils import logger
from config import CSV_DIR

def main() -> None:

    """
    Checa se a ultima atualização do relatório já foi extraído de acordo com a ultima atualização na rede
    """

    while True:
        """
        Há dois caminhos parecidos, mas eu precisei de suporte para computadores diferentes,
        por ter o prefixo Z: e Y:. Então, o código checa se o arquivo existe em Z: ou Y: e pega o que existir.
        Opção futura será criar uma base de dados com os caminhos
        """
        caminhos = (
            r"Z:\PCP\2.2- Relatório Semanal - NOVO.xlsb",
            r"Y:\PCP\2.2- Relatório Semanal - NOVO.xlsb",
        )

        caminho = next((item for item in caminhos if os.path.exists(item)), None)

        if caminho is None:
            print("Relatório semanal não encontrado em Z: nem Y:. Tentando novamente em 60 segundos.")
            sleep(60)
            continue
        
        # Verifica a data de modificação
        timestamp = os.path.getmtime(caminho)
        modificacao = datetime.fromtimestamp(timestamp)
        
        log_csv = CSV_DIR / "log_atualizacao.csv"
        data_hora = None

        if log_csv.exists() and log_csv.stat().st_size > 0:
             df = pd.read_csv(log_csv, nrows=1)
             data_hora = df.columns[0]


        if str(modificacao) != str(data_hora): # se a ultima modificacao ainda não doi extraida, então ele extrai
            print(f"Atualizando dados... {modificacao}")

            tentativas = 3
            sucesso = False

            for tentativa in range(0, tentativas):
                try:   
                    executar()
                    sucesso = True
                    break

                except Exception as e:
                    erro_msg = f"Erro ao executar a função 'executar': {e}. Tentativa {tentativas + 1} de 3."
                    print(erro_msg)

                    logger.error(
                        f"Erro ao executar a função 'executar': {e}", 
                        extra_data = {"extra_data": {"tentativa": tentativas + 1, "erro": str(e), "arquivo": caminho}}
                    )

                    if tentativa < tentativas - 1:
                        print("Tentando novamente em 60 segundos...")
                        sleep(60)

            if sucesso:
                registrar_log(modificacao=modificacao)
                print("Procurando...")

            else:
                print("Todas as tentativas falharam, tentando novamente...")
                sleep(60)

        else:
            print("Procurando...")
            sleep(60)


def registrar_log(modificacao) -> None:
        with open (CSV_DIR / "log_atualizacao.csv", "w", encoding="utf-8") as file: #salva a aultima alteração e procura por novas
            file.write(f"{modificacao}")
            print(f"última atualização em {modificacao}")


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
