from schemas import HistoricoInventario
from csv import DictWriter, DictReader
from datetime import date, datetime, timedelta

def registrar_contagem(codigo, galpao, tipo, observacao=""):
    try:

        descricao = buscar_descricao(codigo)
        media = buscar_media(codigo)
        sistema = buscar_estoque_sistema(codigo)

        divergente = calcular_divergencia(sistema, galpao)
        porcentagem = calcular_porcentagem(sistema, galpao)

        data = data_contagem()
        hora = hora_contagem()

        dados = HistoricoInventario(
            codigo=codigo,
            descricao=descricao,
            media=media,
            sistema=sistema,
            galpao=galpao,
            divergente=divergente,
            porcentagem=porcentagem,
            data=data,
            hora=hora,
            tipo=tipo,
            observacao=observacao
        )

        return salvar_contagem(dados)
    
    except:
        False


def salvar_contagem(historico: HistoricoInventario):
    try:
        with open("dados/csv/historico_inventario.csv", "a", newline="", encoding='utf-8') as file:
            writer = DictWriter(
                file,
                fieldnames=HistoricoInventario.model_fields.keys()
            )
            writer.writerow(historico.model_dump(mode="json"))
            return True

    except Exception:
        return False


def buscar_descricao(codigo: int) -> str:
    """
    Busca a descrição do produto no histórico.
    Caso não encontre, retorna uma descrição padrão.
    """
    try:
        with open(
            "dados/csv/historico_inventario.csv",
            "r",
            encoding="utf-8"
        ) as file:
            reader = DictReader(file)

            for linha in reader:
                if int(linha["codigo"]) == codigo:
                    return linha["descricao"]

    except FileNotFoundError:
        pass

    return "PRODUTO NÃO ENCONTRADO"


def buscar_media(codigo: int) -> float:
    """
    Calcula a média de dias entre as contagens de um item.

    Fórmula:
        (última_data - primeira_data) / quantidade_de_contagens

    Se houver apenas uma ou nenhuma contagem, retorna 1.
    """

    datas = []

    try:
        with open(
            "dados/csv/historico_inventario.csv",
            "r",
            encoding="utf-8-sig"
        ) as file:

            reader = DictReader(file)

            for linha in reader:

                if int(linha["codigo"]) != codigo:
                    continue

                texto = linha["data"].strip()

                try:
                    data = datetime.strptime(texto, "%d/%m/%Y").date()
                except ValueError:
                    data = datetime.strptime(texto, "%Y-%m-%d").date()

                datas.append(data)

    except FileNotFoundError:
        return 1

    if len(datas) <= 1:
        return 1

    datas.sort()

    dias = (datas[-1] - datas[0]).days

    return round(dias / (len(datas) - 1))


def buscar_estoque_sistema(codigo: int) -> int:
    """
    Temporário.
    Futuramente buscará no ERP.
    """
    return 10


def calcular_divergencia(sistema: int, galpao: int) -> int:
    """
    Diferença absoluta entre sistema e galpão.
    """
    return str(abs(sistema - galpao))


def calcular_porcentagem(sistema: int, galpao: int) -> float:
    """
    Calcula a divergência percentual.
    """

    if sistema == 0:
        return 0

    diferenca = abs(sistema - galpao)

    return str(round((diferenca / sistema) * 100, 2))

def data_contagem():
    data = date.today().isoformat()
    return data

def hora_contagem():
    hora = datetime.now().strftime("%H:%M:%S")
    return hora

def ultima_contagem(codigo: int) -> date:
    """
    Calcula a média de dias entre as contagens de um item.

    Fórmula:
        (última_data - primeira_data) / quantidade_de_contagens

    Se houver apenas uma ou nenhuma contagem, retorna 1.
    """
    datas = []
    try:
        with open(
            "dados/csv/historico_inventario.csv",
            "r",
            encoding="utf-8-sig"
        ) as file:

            reader = DictReader(file)

            for linha in reader:

                if int(linha["codigo"]) != codigo:
                    continue

                texto = linha["data"].strip()

                try:
                    data = datetime.strptime(texto, "%d/%m/%Y").date()
                except ValueError:
                    data = datetime.strptime(texto, "%Y-%m-%d").date()

                datas.append(data)

    except FileNotFoundError:
        return None

    if len(datas) <= 1:
        return None
    datas.sort()

    return datas[-1]

def itens_a_contar():
    """
    Retorna lista de produtos que precisam ser contados hoje
    com base na média de dias entre contagens.
    """

    produtos = {}

    try:
        with open(
            "dados/csv/historico_inventario.csv",
            "r",
            encoding="utf-8-sig"
        ) as file:

            reader = DictReader(file)

            for linha in reader:
                codigo = int(linha["codigo"])
                data_str = linha["data"].strip()

                if not data_str:
                    continue

                try:
                    data = datetime.strptime(data_str, "%d/%m/%Y").date()
                except ValueError:
                    try:
                        data = datetime.strptime(data_str, "%Y-%m-%d").date()
                    except ValueError:
                        continue

                if codigo not in produtos:
                    produtos[codigo] = {
                        "codigo": codigo,
                        "descricao": linha["descricao"],
                        "datas": []
                    }

                produtos[codigo]["datas"].append(data)

    except FileNotFoundError:
        return []

    hoje = date.today()
    resultado = []

    for codigo, info in produtos.items():

        datas = sorted(info["datas"])
        total_contagens = len(datas)
        ultima_data = datas[-1]

        # cálculo da média
        if total_contagens <= 1:
            media_dias = 1
        else:
            dias = (datas[-1] - datas[0]).days
            media_dias = max(1, dias // (total_contagens - 1))

        proxima_contagem = ultima_data + timedelta(days=media_dias)

        precisa_contar = hoje >= proxima_contagem

        if precisa_contar:
            resultado.append({
                "codigo": codigo,
                "descricao": info["descricao"],
                "total_contagens": total_contagens,
                "ultima_contagem": ultima_data.isoformat(),
                "media_dias": media_dias,
                "proxima_contagem": proxima_contagem.isoformat()
            })

    return resultado


if __name__ == "__main__":
    print(itens_a_contar())
