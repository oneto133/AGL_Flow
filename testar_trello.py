import os
import requests
from dotenv import load_dotenv

# Carrega as variáveis do arquivo .env
load_dotenv()

# Captura as credenciais
TRELLO_KEY = os.getenv("TRELLO_API_KEY")
TRELLO_TOKEN = os.getenv("TRELLO_TOKEN")

# Mapeamento completo trazendo os IDs configurados no seu .env
MAPEAMENTO_COMPLETO = {
    "SEÇÃO DESLIZANTES": {
        "Célula 6 - MARCIELE": os.getenv("TRELLO_CELULA6_DZ"),
        "Célula 2 - JULLIE": os.getenv("TRELLO_CELULA2_DZ"),
        "Célula 5 - CRISTIANE": os.getenv("TRELLO_CELULA5_DZ"),
        "Célula 3 - BIANCA": os.getenv("TRELLO_CELULA3_DZ")
    },
    "SEÇÃO NEW BV": {
        "NEW BV": os.getenv("TRELLO_NEWBV")
    },
    "SEÇÃO BASCULANTES": {
        "BASCULANTE": os.getenv("TRELLO_BASCULANTE"),
        "Célula 1 - PIVOTANTE - ADRIANO": os.getenv("TRELLO_CELULA1_PIVOTANTE"),
        "Célula 2 - PIVOTANTE - CARLOS": os.getenv("TRELLO_CELULA2_PIVOTANTE"),
        "Célula 3 - PIVOTANTE - ROLF": os.getenv("TRELLO_CELULA3_PIVOTANTE")
    }
}

def disparar_teste_trello(nome_celula, id_lista):
    # Monta a URL parametrizada
    url = f"https://trello.com{TRELLO_KEY}&token={TRELLO_TOKEN}"
    
    if not id_lista:
        print(f"  ⚠️  [ERRO]: ID da lista está VAZIO ou não configurado no .env")
        return False

    payload = {
        "idList": id_lista,
        "name": f"🧪 Teste Automatizado - {nome_celula}",
        "desc": "Este é um cartão de verificação para validar a integração e os IDs das listas."
    }

    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json"
    }

    try:
        resposta = requests.post(url, json=payload, headers=headers, timeout=10)
        
        if resposta.status_code == 200:
            print(f"  ✅ [SUCESSO]: Cartão criado com sucesso!")
            return True
        else:
            print(f"  ❌ [FALHA]: Código {resposta.status_code} - Resposta do Trello: {resposta.text}")
            return False
            
    except Exception as e:
        print(f"  ❌ [ERRO DE CONEXÃO]: {str(e)}")
        return False


def rodar_diagnostico():
    print("==================================================")
    print("       DIAGNÓSTICO DE INTEGRAÇÃO DO TRELLO        ")
    print("==================================================")
    
    # Validação inicial de credenciais
    if not TRELLO_KEY or not TRELLO_TOKEN:
        print("❌ ERRO CRÍTICO: TRELLO_API_KEY ou TRELLO_TOKEN não foram encontrados no .env!")
        return

    print(f"Chave da API carregada: {TRELLO_KEY[:5]}... (oculto)")
    print(f"Token carregado: {TRELLO_TOKEN[:5]}... (oculto)\n")

    # Percorre cada seção e testa suas respectivas células
    for secao, celulas in MAPEAMENTO_COMPLETO.items():
        print(f"\n📂 Verificando {secao}:")
        print("-" * 40)
        
        for nome_celula, id_lista in celulas.items():
            print(f"👉 Testando '{nome_celula}' (ID: {id_lista})...")
            disparar_teste_trello(nome_celula, id_lista)

    print("\n==================================================")
    print("              DIAGNÓSTICO CONCLUÍDO               ")
    print("==================================================")

if __name__ == "__main__":
    rodar_diagnostico()
