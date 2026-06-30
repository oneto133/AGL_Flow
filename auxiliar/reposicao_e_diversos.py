import pandas as pd
from pathlib import Path

class main:
    """
    Filtra para gerar o relatório de reposição e diversos
    Esse arquivo gera os dados que serão usado na aplicação de etiquetas
    """
    def __init__(self):
        
        #Caminho do relatório extraído
        self.relatorio = r"csv/Pendencias - Geral.csv"
        #Caminho da aplicação de etiquetas na rede
        projeto = Path(__file__).resolve().parents[1]
        self.reposicao_e_diversos = projeto / "dados" / "csv" / "Reposicao e Diversos.csv"

    def filtro(self):
        df = pd.read_csv(self.relatorio, encoding="utf-8-sig", skiprows=1)

        motores = df[(df["Departamento"] == "MOTORES") & (df["Unnamed: 11"] != 0) & (df["Seção"] == "REPOSIÇÃO E DIVERSOS -MOTOR")]
        cancelas = df[(df["Departamento"] == "CANCELAS") & (df["Unnamed: 11"] != 0) & (df["Seção"] == "REPOSIÇÃO E DIVERSOS -CANCELAS")]

        reposicao = pd.concat([motores, cancelas])


        self.reposicao_e_diversos.parent.mkdir(parents=True, exist_ok=True)
        reposicao.to_csv(self.reposicao_e_diversos, index=False, encoding="utf-8-sig")


if __name__ == "__main__":
    obj = main()

    obj.filtro()


