from services.cartao import ler_base_de_dados, atualizar_base_de_dados, produto
from services.enviar_trello import executar
from .criar_sequenciamento import sequenciar
from .verificar_cartao import verificar_cartoes
from .historico_inventario import registrar_contagem, buscar_descricao, buscar_media, buscar_estoque_sistema, itens_a_contar