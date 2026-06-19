import pandas as pd
import csv


def cartao(
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
):
    


    conteudo_cartao = {
        "titulo": (descricao, qtd, op),
        "conteudo": 

        f"""
        CÓDIGO DO PRODUTO:   {codigo} \n
        PRODUTO:   {descricao}\n
        \n

        ORDEM DE PRODUCÃO:   {op} \n
        QUANTIDADE:    {qtd}UND \n
        \n

        ------ESPECIFICAÇÕES------ \n
        CENTRAL:     {central} \n
        BASE:        {base}\n
        ENGRENAGEM:  {engrenagem}\n
        ESTATOR E SEM FIM: {estator_e_sem_fim} \n
        CAPACITOR:   {capacitor} \n
        TAMPA:       {tampa} \n
        CILINDRO:    {cilindro} \n
        CONTROLE:    {controle} \n
        """
    }

def atualizar_base_de_dados(arq):
    para_csv = pd.read_excel(arq)
    
    primeira_coluna = para_csv.columns[0]
    para_csv[primeira_coluna] = para_csv[primeira_coluna].astype("Int64")

    para_csv.to_csv(r"csv/base_de_dados.csv", index=False, encoding='utf-8')

def ler_base_de_dados(arq, codigo) -> list:

    df = pd.read_csv(arq, encoding='utf-8')

    retorno = df[df["CÓD DO PRODUTO"] == codigo]
    if not retorno.empty:
        lista = retorno.values[0].tolist()
        
        print(lista)
        return lista
    
    else:
        return []


#atualizar_base_de_dados(r"Y:\Produção\Etiquetas\Nova pasta\xlsx\base_de_dados.xlsx")

ler_base_de_dados(r"Y:\Produção\Etiquetas\Nova pasta\csv\base_de_dados.csv", 2001161)
