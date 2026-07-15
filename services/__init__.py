from services.cartao import ler_base_de_dados, atualizar_base_de_dados, produto
from services.enviar_trello import executar
from .criar_sequenciamento import sequenciar
from .verificar_cartao import verificar_cartoes
from .historico_inventario import registrar_contagem, buscar_descricao, buscar_media, buscar_estoque_sistema, itens_a_contar
from .coleta_refugos import _registrar_contagem, buscar_produtos, contados_hoje, importar_base_xlsx, csv_para_xlsx, xlsx_para_csv
from .qualidade_inspecoes import (
    listar_secoes_inspecao,
    listar_linhas_por_secao,
    listar_ops_por_linha,
    buscar_op_inspecao,
    buscar_produto_inspecao,
    adicionar_item_base_qualidade,
    listar_inspecoes_do_dia,
    buscar_inspecao_dados_por_id,
    salvar_inspecao,
)
