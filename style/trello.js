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

  window.addEventListener('focus', () => {
    setTimeout(() => {
      if (document.body.contains(inputArquivo) && !inputArquivo.files.length) {
        document.body.removeChild(inputArquivo);
      }
    }, 300);
  }, { once: true });

  inputArquivo.click();
}

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

document.addEventListener("DOMContentLoaded", () => {
    const btnMenuLinhas = document.getElementById("btnMenuLinhas");
    const containerListaLinhas = document.getElementById("containerListaLinhas");

    // 1. Controla o abrir/fechar do menu de linhas e busca os dados da API
    btnMenuLinhas.addEventListener("click", () => {
        if (containerListaLinhas.style.display === "none" || containerListaLinhas.style.display === "") {
            containerListaLinhas.style.display = "flex";
            renderizarLinhasDoCSV();
        } else {
            containerListaLinhas.style.display = "none";
        }
    });

    // 2. Busca as linhas na API e renderiza os elementos na tela
    function renderizarLinhasDoCSV() {
        containerListaLinhas.innerHTML = "<p style='color: gray; font-size: 12px;'>Carregando linhas...</p>";

        fetch('/api/consultar/linhas')
            .then(response => response.json())
            .then(res => {
                if (res.status === 200) {
                    containerListaLinhas.innerHTML = ""; // Limpa o carregando

                    res.mensagem.forEach(nomeLinha => {
                        // Cria o container individual da linha
                        const itemLinha = document.createElement("div");
                        itemLinha.style.marginBottom = "8px";

                        // Cria o botão/texto com o nome da linha
                        const btnLinha = document.createElement("button");
                        btnLinha.type = "button";
                        btnLinha.className = "btn-acao"; // Reaproveita seus estilos
                        btnLinha.style.width = "100%";
                        btnLinha.style.textAlign = "left";
                        btnLinha.innerText = nomeLinha;

                        // Cria o bloco do formulário de edição (escondido por padrão)
                        const formEdicao = document.createElement("div");
                        formEdicao.style.display = "none";
                        formEdicao.style.marginTop = "5px";
                        formEdicao.style.gap = "5px";

                        formEdicao.innerHTML = `
                            <input type="text" class="input-edicao-linha" value="${nomeLinha}" style="flex: 1; padding: 4px; border: 1px solid #ccc; border-radius: 4px; color: #000;">
                            <button type="button" class="btn-salvar-linha" style="padding: 4px 8px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">✔</button>
                        `;

                        // Evento: Ao clicar no nome da linha, abre/fecha o input embaixo
                        btnLinha.addEventListener("click", () => {
                            formEdicao.style.display = formEdicao.style.display === "none" ? "flex" : "none";
                        });

                        // Evento: Ao clicar no botão de check (salvar)
                        const btnSalvar = formEdicao.querySelector(".btn-salvar-linha");
                        const inputNovoNome = formEdicao.querySelector(".input-edicao-linha");

                        btnSalvar.addEventListener("click", () => {
                            const novoNome = inputNovoNome.value.trim();
                            if (novoNome && novoNome !== nomeLinha) {
                                salvarNovoNomeLinha(nomeLinha, novoNome);
                            }
                        });

                        // Junta as partes e joga no container principal
                        itemLinha.appendChild(btnLinha);
                        itemLinha.appendChild(formEdicao);
                        containerListaLinhas.appendChild(itemLinha);
                    });
                } else {
                    containerListaLinhas.innerHTML = `<p style='color: red;'>Erro: ${res.mensagem}</p>`;
                }
            })
            .catch(err => {
                console.error(err);
                containerListaLinhas.innerHTML = "<p style='color: red;'>Erro de conexão.</p>";
            });
    }

    // 3. Envia o comando de alteração para o seu FastAPI
    function salvarNovoNomeLinha(nomeAtual, nomeNovo) {
        const url = `/api/config/alterar-nome-celula?atual=${encodeURIComponent(nomeAtual)}&novo=${encodeURIComponent(nomeNovo)}`;

        fetch(url, { method: 'POST' })
            .then(response => response.json())
            .then(dados => {
                if (dados.status === 200) {
                    alert(`Sucesso! ${dados.mensagem}`);
                    renderizarLinhasDoCSV(); // Recarrega a lista com os novos nomes atualizados
                } else {
                    alert(`Erro: ${dados.mensagem}`);
                }
            })
            .catch(erro => {
                console.error(erro);
                alert('Erro de comunicação com o servidor.');
            });
    }
});

document.addEventListener("DOMContentLoaded", () => {
    // Captura todas as seções retráteis da sidebar
    const titulosGatilho = document.querySelectorAll(".titulo-gatilho");

    titulosGatilho.forEach(titulo => {
        titulo.addEventListener("click", () => {
            // Encontra o container de conteúdo logo abaixo do título clicado
            const conteudo = titulo.nextElementSibling;
            const seta = titulo.querySelector(".seta-icone");

            // Alterna a exibição entre bloco e oculto
            if (conteudo.style.display === "none") {
                conteudo.style.display = "block";
                seta.innerText = "▼"; // Seta para baixo se aberto
            } else {
                conteudo.style.display = "none";
                seta.innerText = "►"; // Seta para o lado se fechado
            }
        });
    });

    // ... Mantenha o restante das suas funções de renderizarLinhasDoCSV() e salvarNovoNomeLinha() abaixo ...
});
