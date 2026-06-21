const manualCode = document.querySelector("#manualCode");
const manualSearchButton = document.querySelector("#manualSearchButton");
const manualDescription = document.querySelector("#manualDescription");
const manualQuantity = document.querySelector("#manualQuantity");
const trelloLine = document.querySelector("#trelloLine");
const trelloLineArrow = document.querySelector("#trelloLineArrow"); // Nova seta mapeada
const trelloLineDropdown = document.querySelector("#trelloLineDropdown");
const trelloForm = document.querySelector("#trelloForm");
const statusMessage = document.querySelector("#statusMessage");
const manualOP = document.querySelector("#manualOP");

let timeout = null;
let ultimaBusca = "";

// CORRIGIDO: Alterado de 'const' para 'let' para permitir a atualização da lista dinamicamente
let opcoesCelulas = []; 
let primeiraOpcaoFiltrada = "";

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


// Evento ao digitar no campo (Filtra dinamicamente)
trelloLine?.addEventListener("input", (e) => {
  renderizarDropdown(e.target.value.trim());
});

// Evento ao clicar na SETA LATERAL (Abre ou fecha todas as opções)
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
    // CORRIGIDO: Chave alterada de 'quantidade: quantidade' para 'quantidade' combinando com o Pydantic do Python
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
