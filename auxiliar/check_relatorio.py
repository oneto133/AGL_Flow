import asyncio
import os
from datetime import datetime

import pandas as pd

from .atualizar_lista_tecnica import main as atualizarLT
from .copiar_relatorio import main as copiar
from .extrair_csvs import main as extracao
from .reposicao_e_diversos import main as relatorioDiversos
from config import CSV_DIR
from utils import logger


async def main() -> None:
    """Verifica periodicamente se o relatório da rede foi atualizado."""
    while True:
        caminhos = (
            r"Z:\PCP\2.2- Relatório Semanal - NOVO.xlsb",
            r"Y:\PCP\2.2- Relatório Semanal - NOVO.xlsb",
        )
        caminho = next((item for item in caminhos if os.path.exists(item)), None)

        if caminho is None:
            print("Relatório semanal não encontrado em Z: nem Y:. Tentando novamente em 60 segundos.")
            await asyncio.sleep(60)
            continue

        modificacao = datetime.fromtimestamp(os.path.getmtime(caminho))
        log_csv = CSV_DIR / "log_atualizacao.csv"
        data_hora = None

        if log_csv.exists() and log_csv.stat().st_size > 0:
            df = pd.read_csv(log_csv, nrows=1)
            data_hora = df.columns[0]

        if str(modificacao) != str(data_hora):
            print(f"Atualizando dados... {modificacao}")
            sucesso = False

            for tentativa in range(3):
                try:
                    await executar()
                    sucesso = True
                    break
                except Exception as exc:
                    erro_msg = (
                        f"Erro ao executar a função 'executar': {exc}. "
                        f"Tentativa {tentativa + 1} de 3."
                    )
                    print(erro_msg)
                    logger.error(
                        f"Erro ao executar a função 'executar': {exc}",
                        extra_data={
                            "extra_data": {
                                "tentativa": tentativa + 1,
                                "erro": str(exc),
                                "arquivo": caminho,
                            }
                        },
                    )
                    if tentativa < 2:
                        print("Tentando novamente em 60 segundos...")
                        await asyncio.sleep(60)

            if sucesso:
                registrar_log(modificacao)
                print("Procurando...")
            else:
                print("Todas as tentativas falharam, tentando novamente...")
                await asyncio.sleep(60)
        else:
            print("Procurando...")
            await asyncio.sleep(60)


def registrar_log(modificacao) -> None:
    with open(CSV_DIR / "log_atualizacao.csv", "w", encoding="utf-8") as file:
        file.write(f"{modificacao}")
        print(f"Última atualização em {modificacao}")


async def executar() -> str:
    """Copia e processa o relatório sem bloquear o event loop."""
    await copiar().relatorio_vendas()
    await asyncio.to_thread(extracao)
    await asyncio.to_thread(atualizarLT)
    await asyncio.to_thread(relatorioDiversos().filtro)
    print("Dados atualizados")
    return "Dados atualizados"


if __name__ == "__main__":
    asyncio.run(main())
