import os
import shutil

class main:
    def __init__(self):
        pass

    def relatorio_vendas(self):
                
        caminhos = (
            r"Z:\PCP\2.2- Relatório Semanal - NOVO.xlsb",
            r"Y:\PCP\2.2- Relatório Semanal - NOVO.xlsb",
        )
        origem = next((item for item in caminhos if os.path.exists(item)), None)
        if origem is None:
            raise FileNotFoundError("Relatório semanal não encontrado em Z: nem Y:.")

        destino = r"temp\relatorio_semanal_temp.xlsx"
        os.makedirs(os.path.dirname(destino), exist_ok=True)


        shutil.copy2(origem, destino)

if __name__ ==" __main__":
    relatorio = main()
    relatorio.relatorio_vendas()

