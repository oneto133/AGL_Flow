import pandas as pd

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


if __name__ == "__main__":
    _alterar_nome_linha("teste", "teste1")