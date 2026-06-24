const manualCode = document.querySelector("#manualCode");
const manualSearchButton = document.querySelector("#manualSearchButton");
const manualDescription = document.querySelector("#manualDescription");
const manualQuantity = document.querySelector("#manualQuantity");
const trelloLine = document.querySelector("#trelloLine");
const trelloLineArrow = document.querySelector("#trelloLineArrow");
const trelloLineDropdown = document.querySelector("#trelloLineDropdown");
const trelloForm = document.querySelector("#trelloForm");
const statusMessage = document.querySelector("#statusMessage");
const manualOP = document.querySelector("#manualOP");

const btnConfig = document.getElementById('config-button');
const sideBar = document.getElementById('configSidebar');
const btnFechar = document.getElementById('fecharSidebar');


let timeout = null;
let ultimaBusca = "";
let opcoesCelulas = []; 
let primeiraOpcaoFiltrada = "";

btnConfig?.addEventListener('click', (e) => {
  e.preventDefault();
  
  btnConfig.classList.add('girar-engrenagem');
  
  setTimeout(() => {
    btnConfig.classList.remove('girar-engrenagem');
  }, 800);

  sideBar?.classList.add('aberto');
});

btnFechar?.addEventListener('click', () => {
  sideBar?.classList.remove('aberto');
});


trelloLine?.addEventListener("input", (e) => {
  renderizarDropdown(e.target.value.trim());
});

trelloLineArrow?.addEventListener("click", (e) => {
  e.stopPropagation(); // Evita que o evento de clique global feche o menu imediatamente
  if (trelloLineDropdown.style.display === "block") {
    trelloLineDropdown.style.display = "none";
  } else {
    renderizarDropdown(trelloLine.value.trim(), true); // Mostra tudo ou o filtro atual
    trelloLine.focus();
  }
});

// Evento ao clicar no próprio INPUT (Abre a lista completa facilitando a usabilidade)
trelloLine?.addEventListener("click", (e) => {
  e.stopPropagation();
  renderizarDropdown(trelloLine.value.trim(), true);
});

// Captura a tecla TAB ou ENTER para fazer o autocompletar instantâneo
trelloLine?.addEventListener("keydown", (e) => {
  if ((e.key === "Tab" || e.key === "Enter") && primeiraOpcaoFiltrada) {
    if (trelloLine.value.toLowerCase() !== primeiraOpcaoFiltrada.toLowerCase()) {
      e.preventDefault(); 
      trelloLine.value = primeiraOpcaoFiltrada;
      trelloLineDropdown.style.display = "none";
    }
  }
});

// Fecha a lista se clicar em qualquer outra parte vazia da tela
document.addEventListener("click", (e) => {
  if (e.target !== trelloLine && e.target !== trelloLineDropdown && e.target !== trelloLineArrow) {
    if (trelloLineDropdown) trelloLineDropdown.style.display = "none";
  }
});

// --- LÓGICA DE BUSCA DO PRODUTO ---

manualSearchButton?.addEventListener("click", () => {
  const codigo = manualCode.value.trim();
  if (!codigo) {
    statusMessage.textContent = "Digite um código para buscar.";
    statusMessage.className = "login-status error";
    return;
  }
  buscarProduto(codigo);
});

manualCode?.addEventListener("input", () => {
  const codigo = manualCode.value.trim();
  if (codigo.length < 7) {
    manualDescription.value = "";
    opcoesCelulas = [];
    if (trelloLineDropdown) trelloLineDropdown.style.display = "none";
    ultimaBusca = "";
    return;
  }
  if (codigo === ultimaBusca) return;
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    buscarProduto(codigo);
  }, 300);
});

async function buscarProduto(codigo) {
  try {
    ultimaBusca = codigo;
    statusMessage.textContent = "Buscando produto...";
    statusMessage.className = "login-status success";

    const response = await fetch(`/api/produto?codigo=${codigo}`);
    const data = await response.json();

    if (data.erro || !data.descricao) {
      manualDescription.value = "";
      opcoesCelulas = []; // Limpa se não achar
      trelloLine.value = ""; 
      statusMessage.textContent = data.erro || "Produto não encontrado.";
      statusMessage.className = "login-status error";
      return;
    }

    manualDescription.value = data.descricao;
    
    // FUNCIONA AGORA: Atribuição permitida pois alteramos para 'let' na linha 16
    opcoesCelulas = data.opcoes || [];
    trelloLine.value = ""; // Limpa escolhas antigas
    
    statusMessage.textContent = "";
    statusMessage.className = "login-status";
    
  } catch (error) {
    console.error("Erro ao buscar produto:", error);
    statusMessage.textContent = "Erro ao buscar produto. Tente novamente.";
    statusMessage.className = "login-status error";
  }
}

async function enviar_para_trello(codigo, quantidade, op, linhaCelula) {
  const response = await fetch("/api/enviar-para-trello", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ codigo, quantidade, op, linhaCelula })
  });
  const data = await response.json();
  if (!response.ok || data.erro) {
    throw new Error(data.erro || "Erro ao enviar para Trello.");
  }
  return data;
}

trelloForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!manualDescription.value.trim()) {
    statusMessage.textContent = "Busque e valide o produto antes de enviar.";
    statusMessage.className = "login-status error";
    return;
  }
  try {
    statusMessage.textContent = "Enviando dados para o Trello...";
    statusMessage.className = "login-status success";

    await enviar_para_trello(
      manualCode.value.trim(),
      manualQuantity.value,
      manualOP.value.trim(),
      trelloLine.value
    );

    statusMessage.textContent = "Dados enviados com sucesso!";
    statusMessage.className = "login-status success";
    trelloForm.reset();
    manualDescription.value = "";
    opcoesCelulas = [];
  } catch (error) {
    console.error("Erro capturado no envio:", error);
    statusMessage.textContent = error.message || "Erro ao enviar para o Trello. Tente novamente.";
    statusMessage.className = "login-status error";
  }
});

function renderizarDropdown(textoDigitado, forcarMostrarTudo = false) {
  if (!trelloLineDropdown) return;
  trelloLineDropdown.innerHTML = "";
  
  if (!opcoesCelulas || opcoesCelulas.length === 0) {
    trelloLineDropdown.style.display = "none";
    return;
  }

  const filtradas = forcarMostrarTudo ? opcoesCelulas : opcoesCelulas.filter(opcao => 
    opcao.toLowerCase().includes(textoDigitado.toLowerCase())
  );

  if (filtradas.length === 0) {
    trelloLineDropdown.style.display = "none";
    primeiraOpcaoFiltrada = "";
    return;
  }

  primeiraOpcaoFiltrada = filtradas[0];

  filtradas.forEach((opcao, index) => {
    const li = document.createElement("li");
    li.textContent = opacity = opcao;
    
    if (index === 0) {
      li.classList.add("highlighted");
    }

    // ALTERADO: Usar mousedown e impedir a propagação do clique
    li.addEventListener("mousedown", (e) => {
      e.preventDefault(); // Evita que o input perca o foco antes da hora
      e.stopPropagation(); // Evita que o clique feche/reabra o menu incorretamente
      trelloLine.value = opcao;
      trelloLineDropdown.style.display = "none";
    });

    trelloLineDropdown.appendChild(li);
  });

  trelloLineDropdown.style.display = "block";
}

// --- LÓGICA DE EXIBIÇÃO DA SIDEBAR (BOTÕES DIREOTOS) ---
const botoesMenuConfig = document.querySelectorAll('.config-menu-btn');

botoesMenuConfig.forEach(botao => {
  botao.addEventListener('click', (e) => {
    e.stopPropagation();
    const grupoAtual = Math = botao.parentElement;
    
    // Fecha as outras abas para manter a organização visual do painel
    document.querySelectorAll('.config-grupo').forEach(grupo => {
      if (grupo !== grupoAtual) {
        grupo.classList.remove('ativo');
      }
    });

    // Abre os botões do grupo clicado
    grupoAtual.classList.toggle('ativo');
  });
});

const botoesAcao = document.querySelectorAll('.btn-acao');
botoesAcao.forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const tipo = btn.getAttribute('data-tipo'); // ex: deslizante, new_bv...
    const acao = btn.getAttribute('data-acao'); // ex: upload, download
    
    if (acao === 'download') {
      executarDownloadBase(tipo);
    } else if (acao === 'upload') {
      console.log(`Ação de Upload para a linha: ${tipo}`);
      executarUploadBase(tipo); // <--- CORREÇÃO 1: A função precisa ser chamada aqui!
    }
  });
});

async function executarUploadBase(tipoProduto) {
  // 1. Cria um seletor de arquivos
  const inputArquivo = document.createElement('input');
  inputArquivo.type = 'file';
  inputArquivo.accept = '.xlsx'; 
  inputArquivo.style.display = 'none'; // Garante que fique invisível

  // CORREÇÃO 2: Anexa ao documento temporariamente para evitar bloqueios do navegador
  document.body.appendChild(inputArquivo);

  // 2. Quando o usuário escolher o arquivo, o evento dispara
  inputArquivo.addEventListener('change', async () => {
    const arquivo = inputArquivo.files[0];
    
    // Limpa o elemento do HTML logo após a escolha
    document.body.removeChild(inputArquivo);
    
    if (!arquivo) return;

    // 3. Monta os dados para o envio (Multipart Form Data)
    const formData = new FormData();
    formData.append('arquivo', arquivo);

    try {
      console.log(`Iniciando upload para a linha: ${tipoProduto}`);
      
      // 4. Faz a requisição enviando o tipo na URL e o arquivo no corpo
      const response = await fetch(`/api/config/upload?tipo=${tipoProduto}`, {
        method: "POST",
        body: formData
      });

      const resultado = await response.json();

      if (!response.ok) {
        throw new Error(resultado.detail || "Erro desconhecido ao enviar o arquivo.");
      }

      alert(`Sucesso: ${resultado.mensagem}`);
      console.log(`Upload da linha ${tipoProduto} concluído.`);

    } catch (error) {
      console.error("Erro no fluxo de upload:", error);
      alert("Erro ao enviar o arquivo: " + error.message);
    }
  });

  // Cancelar a seleção também remove o input da tela para não acumular lixo
  window.addEventListener('focus', () => {
    setTimeout(() => {
      if (document.body.contains(inputArquivo) && !inputArquivo.files.length) {
        document.body.removeChild(inputArquivo);
      }
    }, 300);
  }, { once: true });

  inputArquivo.click();
}

// --- FUNÇÃO ADICIONAL PARA ENVIAR A REQUISIÇÃO E BAIXAR O ARQUIVO ---
async function executarDownloadBase(tipoProduto) {
  try {
    console.log(`Iniciando requisição de download para a linha: ${tipoProduto}`);
    
    // Faz a chamada para a sua rota do FastAPI
    const response = await fetch(`/api/config/download?tipo=${tipoProduto}`, {
      method: "GET"
    });

    if (!response.ok) {
      throw new Error("Não foi possível baixar o arquivo da base de dados.");
    }

    // O segredo está aqui: Transforma a resposta em um arquivo binário (Blob)
    const blob = await response.blob();
    
    // Cria um link invisível na memória do navegador para disparar o download
    const urlScript = window.URL.createObjectURL(blob);
    const linkInvisivel = document.createElement('a');
    linkInvisivel.href = urlScript;

    // Define o nome padrão do arquivo que o operador vai salvar
    // O ideal é que o Python envie isso no cabeçalho, mas aqui fixamos um padrão seguro
    linkInvisivel.download = `base_${tipoProduto}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    // Insere o link na tela, clica nele sozinho e depois apaga tudo
    document.body.appendChild(linkInvisivel);
    linkInvisivel.click();
    document.body.removeChild(linkInvisivel);
    window.URL.revokeObjectURL(urlScript);

    console.log(`Download da linha ${tipoProduto} concluído com sucesso.`);

  } catch (error) {
    console.error("Erro no fluxo de download:", error);
    alert("Erro ao baixar o arquivo: " + error.message);
  }
}
