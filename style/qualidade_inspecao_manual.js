document.addEventListener("DOMContentLoaded", () => {
  if ((document.body.dataset.page || "") !== "qualidade-manual-linha") {
    return;
  }

  const status = document.querySelector("#statusMessage");
  const form = document.querySelector("#inspecaoForm");
  const itensLista = document.querySelector("#itensInspecionados");
  const btnBuscarProduto = document.querySelector("#btnBuscarProduto");
  const btnSalvar = document.querySelector("#btnSalvarInspecao");
  const btnSalvarItemRefugo = document.querySelector("#btnSalvarItemRefugo");
  const btnLimparItemRefugo = document.querySelector("#btnLimparItemRefugo");
  const itemModal = document.querySelector("#itemRefugoModal");
  const itemModalTitle = document.querySelector("#itemRefugoTitle");
  const itemModalDescricao = document.querySelector("#itemRefugoDescricao");
  const itemModalLinha = document.querySelector("#itemRefugoLinha");
  const itemModalQuantidade = document.querySelector("#itemRefugoQuantidade");
  const itemModalCodigoNc = document.querySelector("#itemRefugoCodigoNc");
  const itemModalObservacao = document.querySelector("#itemRefugoObservacao");
  const refugoToggle = document.querySelector("#fRefugo");
  const lineChip = document.querySelector("#manualLinhaChip");

  const fields = {
    linha: document.querySelector("#fLinha"),
    op: document.querySelector("#fOp"),
    codigo: document.querySelector("#fCodigo"),
    descricao: document.querySelector("#fDescricao"),
    quantidade: document.querySelector("#fQuantidade"),
    destino: document.querySelector("#fDestino"),
    inicio: document.querySelector("#fInicio"),
    fim: document.querySelector("#fFim"),
    quantidadeNc: document.querySelector("#fQuantidadeNc"),
    codigoNc: document.querySelector("#fCodigoNc"),
    semFim: document.querySelector("#fSemFim"),
    central: document.querySelector("#fCentral"),
    inspecoes: document.querySelector("#fInspecoes"),
    tensao: document.querySelector("#fTensao"),
    status: document.querySelector("#fStatus"),
    resultado: document.querySelector("#fResultado"),
    conformidade: document.querySelector("#fConformidade"),
    observacao: document.querySelector("#fObservacao"),
  };

  const linhaInicial = document.body.dataset.linha || "";
  const idInspecaoReinspecao = new URLSearchParams(window.location.search).get("id_inspecao") || "";
  let produtoCarregado = false;
  let cardRefugoAtivo = null;

  function setStatus(message, type = "") {
    if (!status) {
      return;
    }

    status.textContent = message;
    status.className = `login-status qualidade-status ${type}`.trim();
  }

  function safeText(value) {
    return value == null ? "" : String(value);
  }

  function normalizeText(value) {
    return safeText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function nowForInput() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function nowOrSaved(value) {
    return value || nowForInput();
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(body || `Falha na requisição (${response.status})`);
    }

    return response.json();
  }

  function setSelectValue(select, value) {
    if (!select) {
      return;
    }

    const alvo = safeText(value);
    const optionExists = Array.from(select.options).some((option) => option.value === alvo);
    if (optionExists) {
      select.value = alvo;
    }
  }

  function updateSelectedCount() {
    const countEl = document.querySelector("#itensSelecionadosCount");
    const total = document.querySelectorAll(".quality-item-card .js-item-check:checked").length;
    if (countEl) {
      countEl.textContent = `${total} selecionados`;
    }
  }

  function normalizarChaveItem(item = {}) {
    return [
      safeText(item.codigo_pai || item.codigo_item || item.codigo || ""),
      safeText(item.campo || ""),
      safeText(item.titulo || item.descricao || item.valor || ""),
    ]
      .join("|")
      .toLowerCase();
  }

  function setCardState(card, data = {}) {
    if (!card) {
      return;
    }

    const quantidade = Number(data.quantidade || 0);
    const codigoNc = safeText(data.codigoNc || "");
    const observacao = safeText(data.observacao || "");
    const hasRefugo = quantidade > 0 || codigoNc || observacao;

    card.dataset.refugo = hasRefugo ? "1" : "0";
    card.dataset.refugoQuantidade = String(quantidade || 0);
    card.dataset.refugoCodigoNc = codigoNc;
    card.dataset.refugoObservacao = observacao;
    card.classList.toggle("has-refugo", hasRefugo);

    const detalhes = card.querySelector(".quality-item-card__refugo");
    if (detalhes) {
      const quantidadeEl = detalhes.querySelector("[data-refugo-quantidade]");
      const codigoNcEl = detalhes.querySelector("[data-refugo-codigo-nc]");
      const observacaoEl = detalhes.querySelector("[data-refugo-observacao]");

      if (quantidadeEl) quantidadeEl.textContent = String(quantidade || 0);
      if (codigoNcEl) codigoNcEl.textContent = codigoNc || "-";
      if (observacaoEl) observacaoEl.textContent = observacao || "-";
      detalhes.hidden = !hasRefugo;
    }

    updateSelectedCount();
  }

  function openItemRefugoModal(card) {
    if (!itemModal || !card) {
      return;
    }

    cardRefugoAtivo = card;

    if (itemModalTitle) itemModalTitle.textContent = card.dataset.titulo || "Item";
    if (itemModalDescricao) itemModalDescricao.textContent = card.dataset.valor || "Sem descrição adicional";
    if (itemModalLinha) itemModalLinha.textContent = safeText(fields.linha?.value || linhaInicial || "Linha -");
    if (itemModalQuantidade) itemModalQuantidade.value = String(card.dataset.refugoQuantidade || "0");
    if (itemModalCodigoNc) itemModalCodigoNc.value = card.dataset.refugoCodigoNc || "";
    if (itemModalObservacao) itemModalObservacao.value = card.dataset.refugoObservacao || "";

    itemModal.classList.remove("hidden");
    itemModal.setAttribute("aria-hidden", "false");
    itemModalQuantidade?.focus();
  }

  function closeItemRefugoModal() {
    if (!itemModal) {
      return;
    }

    itemModal.classList.add("hidden");
    itemModal.setAttribute("aria-hidden", "true");
    cardRefugoAtivo = null;
  }

  function salvarItemRefugoModal() {
    if (!cardRefugoAtivo) {
      closeItemRefugoModal();
      return;
    }

    setCardState(cardRefugoAtivo, {
      quantidade: Number(itemModalQuantidade?.value || 0),
      codigoNc: itemModalCodigoNc?.value?.trim() || "",
      observacao: itemModalObservacao?.value?.trim() || "",
    });

    if (refugoToggle) {
      refugoToggle.checked = document.querySelectorAll('.quality-item-card[data-refugo="1"]').length > 0;
    }

    closeItemRefugoModal();
  }

  function limparItemRefugoModal() {
    if (itemModalQuantidade) itemModalQuantidade.value = "0";
    if (itemModalCodigoNc) itemModalCodigoNc.value = "";
    if (itemModalObservacao) itemModalObservacao.value = "";

    if (cardRefugoAtivo) {
      setCardState(cardRefugoAtivo, {});
    }
  }

  function createItemCard(item, index) {
    const card = document.createElement("article");
    card.className = "quality-item-card";
    card.dataset.codigoPai = safeText(item.codigo_pai || item.codigo || "");
    card.dataset.campo = safeText(item.campo || "");
    card.dataset.titulo = safeText(item.titulo || item.descricao || "");
    card.dataset.valor = safeText(item.valor || item.descricao || "");
    card.dataset.index = String(index);
    card.dataset.refugo = "0";
    card.dataset.refugoQuantidade = "0";
    card.dataset.refugoCodigoNc = "";
    card.dataset.refugoObservacao = "";

    card.innerHTML = `
      <div class="quality-item-card__head">
        <div class="quality-item-card__title" role="button" tabindex="0">
          <strong>${safeText(item.titulo || item.descricao || "Item")}</strong>
          <small>${safeText(item.valor || "")}</small>
        </div>
        <label class="quality-item-card__check">
          <input type="checkbox" class="js-item-check">
        </label>
      </div>
      <div class="quality-item-card__refugo" hidden>
        <div class="quality-mini-grid">
          <div>
            <span>Quantidade refugada</span>
            <strong data-refugo-quantidade>0</strong>
          </div>
          <div>
            <span>Código NC</span>
            <strong data-refugo-codigo-nc>-</strong>
          </div>
        </div>
        <div>
          <span>Observação</span>
          <p data-refugo-observacao>-</p>
        </div>
      </div>
    `;

    const checkbox = card.querySelector(".js-item-check");
    const titleArea = card.querySelector(".quality-item-card__title");

    titleArea?.addEventListener("click", () => {
      if (!checkbox?.checked) {
        checkbox.checked = true;
        card.classList.add("is-selected");
      }
      openItemRefugoModal(card);
    });
    titleArea?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        titleArea.click();
      }
    });
    checkbox?.addEventListener("change", () => {
      const checked = !!checkbox.checked;
      card.classList.toggle("is-selected", checked);
      if (!checked) {
        setCardState(card, {});
      }
      updateSelectedCount();
    });

    return card;
  }

  function renderizarItens(itens = []) {
    if (!itensLista) {
      return;
    }

    itensLista.innerHTML = "";

    if (!itens.length) {
      const empty = document.createElement("div");
      empty.className = "quality-empty";
      empty.textContent = "Nenhum item disponível para este produto.";
      itensLista.appendChild(empty);
      updateSelectedCount();
      return;
    }

    itens.forEach((item, index) => {
      const card = createItemCard(item, index);
      setCardState(card, {});
      itensLista.appendChild(card);
    });

    updateSelectedCount();
  }

  function localizarCardPorItem(item) {
    const cards = Array.from(document.querySelectorAll("#itensInspecionados .quality-item-card"));
    const chave = normalizarChaveItem(item);

    return cards.find((card) => {
      const cardChave = [
        safeText(card.dataset.codigoPai || ""),
        safeText(card.dataset.campo || ""),
        safeText(card.dataset.titulo || ""),
      ]
        .join("|")
        .toLowerCase();

      return cardChave === chave
        || (safeText(card.dataset.codigoPai || "") === safeText(item.codigo_pai || item.codigo_item || item.codigo || "")
          && safeText(card.dataset.campo || "") === safeText(item.campo || item.item_campo || ""));
    }) || null;
  }

  function aplicarReinspecao(dados = {}) {
    if (fields.linha && dados.linha) fields.linha.value = dados.linha;
    if (fields.op && dados.op) fields.op.value = String(dados.op);
    if (fields.codigo && dados.codigo) fields.codigo.value = String(dados.codigo);
    if (fields.descricao && dados.descricao) fields.descricao.value = dados.descricao;
    if (fields.quantidade && dados.quantidade_programada) fields.quantidade.value = String(dados.quantidade_programada);
    if (fields.destino && dados.destino) setSelectValue(fields.destino, dados.destino);
    if (fields.status) setSelectValue(fields.status, dados.status || "Em análise");
    if (fields.resultado) setSelectValue(fields.resultado, dados.inspecao_completa ? "true" : "false");
    if (fields.observacao) fields.observacao.value = dados.observacao || "";
    if (fields.semFim) fields.semFim.value = dados.sem_fim || "";
    if (fields.central) fields.central.value = dados.central || "";
    if (fields.tensao) fields.tensao.value = dados.tensao || "";
    if (fields.codigoNc) fields.codigoNc.value = dados.codigo_nc || "";
    if (fields.quantidadeNc) fields.quantidadeNc.value = String(dados.quantidade_nc || 0);
    if (fields.inspecoes) fields.inspecoes.value = String(dados.inspecoes || 0);

    const itens = Array.isArray(dados.itens_inspecionados) ? dados.itens_inspecionados : [];
    const refugos = Array.isArray(dados.refugos) ? dados.refugos : [];

    if (!itensLista) {
      return;
    }

    if (!itens.length && dados.codigo) {
      return;
    }

    itens.forEach((item) => {
      const card = localizarCardPorItem(item);
      if (!card) {
        return;
      }

      const checkbox = card.querySelector(".js-item-check");
      if (checkbox) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event("change"));
      }

      const refugo = refugos.find((registro) => normalizarChaveItem(registro) === normalizarChaveItem(item))
        || refugos.find((registro) =>
          safeText(registro.codigo || registro.codigo_item || "") === safeText(item.codigo_pai || item.codigo_item || item.codigo || "")
          && safeText(registro.campo || registro.item_campo || "") === safeText(item.campo || item.item_campo || ""));

      if (refugo) {
        setCardState(card, {
          quantidade: Number(refugo.quantidade || 0),
          codigoNc: refugo.codigo_nc || "",
          observacao: refugo.observacao || "",
        });
      }
    });

    if (refugoToggle) {
      refugoToggle.checked = document.querySelectorAll('.quality-item-card[data-refugo="1"]').length > 0;
    }

    updateSelectedCount();
  }

  function collectItems() {
    const cards = Array.from(document.querySelectorAll("#itensInspecionados .quality-item-card"));
    const itens = [];
    const refugos = [];

    cards.forEach((card) => {
      const checkbox = card.querySelector(".js-item-check");
      if (!checkbox?.checked) {
        return;
      }

      const codigoPai = Number(card.dataset.codigoPai || 0);
      const campo = card.dataset.campo || "";
      const titulo = card.dataset.titulo || "";
      const quantidade = Number(card.dataset.refugoQuantidade || 0);
      const codigoNc = card.dataset.refugoCodigoNc || "";
      const observacao = card.dataset.refugoObservacao || "";
      const hasRefugo = card.dataset.refugo === "1" || quantidade > 0 || codigoNc || observacao;

      itens.push({
        id: itens.length + 1,
        id_inspecao: 0,
        codigo: codigoPai,
        descricao: titulo,
        campo,
      });

      if (hasRefugo) {
        refugos.push({
          id: refugos.length + 1,
          id_inspecao: 0,
          codigo: codigoPai,
          descricao: titulo,
          campo,
          quantidade,
          codigo_nc: codigoNc,
          observacao,
        });
      }
    });

    return { itens, refugos };
  }

  async function carregarProdutoPorCodigo(codigo) {
    const codigoTexto = safeText(codigo).trim();
    if (!codigoTexto) {
      setStatus("Digite o código para carregar o produto.", "");
      return null;
    }

    try {
      setStatus("Carregando produto...", "");
      const produto = await fetchJson(`/api/qualidade/inspecoes/produto/${encodeURIComponent(codigoTexto)}`);
      produtoCarregado = true;

      if (fields.codigo) fields.codigo.value = String(produto.codigo || codigoTexto);
      if (fields.descricao) fields.descricao.value = produto.descricao || "";
      if (fields.quantidade && !fields.quantidade.value) fields.quantidade.value = String(produto.quantidade || 0);
      if (fields.linha && !fields.linha.value) fields.linha.value = linhaInicial;
      if (lineChip) lineChip.textContent = fields.linha?.value || linhaInicial || "Linha não informada";

      if (fields.semFim) fields.semFim.value = produto.sem_fim || "";
      if (fields.central) fields.central.value = produto.central || "";
      if (fields.tensao) fields.tensao.value = produto.tensao || "";

      renderizarItens(Array.isArray(produto.itens_disponiveis) ? produto.itens_disponiveis : []);
      setStatus("Produto carregado.", "success");
      return produto;
    } catch (error) {
      console.error(error);
      produtoCarregado = false;
      renderizarItens([]);
      setStatus(error.message || "Produto não encontrado.", "error");
      return null;
    }
  }

  async function carregarInspecaoAnterior(idInspecao) {
    if (!idInspecao) {
      return null;
    }

    try {
      setStatus("Carregando inspeção anterior...", "");
      const dados = await fetchJson(`/api/qualidade/inspecoes/dados/${encodeURIComponent(idInspecao)}`);
      const produto = await carregarProdutoPorCodigo(dados.codigo || "");
      if (produto) {
        aplicarReinspecao(dados);
        setStatus("Inspeção anterior carregada.", "success");
      }
      return dados;
    } catch (error) {
      console.error(error);
      setStatus("Não foi possível carregar a inspeção anterior.", "error");
      return null;
    }
  }

  itemModal?.querySelectorAll("[data-close-item-modal]").forEach((button) => {
    button.addEventListener("click", closeItemRefugoModal);
  });
  btnSalvarItemRefugo?.addEventListener("click", salvarItemRefugoModal);
  btnLimparItemRefugo?.addEventListener("click", limparItemRefugoModal);
  itemModal?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeItemRefugoModal();
    }
  });

  btnBuscarProduto?.addEventListener("click", () => {
    carregarProdutoPorCodigo(fields.codigo?.value || "");
  });

  fields.codigo?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      carregarProdutoPorCodigo(fields.codigo?.value || "");
    }
  });

  fields.codigo?.addEventListener("blur", () => {
    if (fields.codigo?.value) {
      carregarProdutoPorCodigo(fields.codigo.value);
    }
  });

  fields.linha?.addEventListener("input", () => {
    if (lineChip) {
      lineChip.textContent = fields.linha?.value || linhaInicial || "Linha não informada";
    }
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const linhaSelecionada = safeText(fields.linha?.value || "").trim();
    const opSelecionada = safeText(fields.op?.value || "").trim();
    const codigoSelecionado = safeText(fields.codigo?.value || "").trim();

    if (!linhaSelecionada || !opSelecionada || !codigoSelecionado) {
      setStatus("Informe linha, OP e código antes de salvar.", "error");
      return;
    }

    const destino = safeText(fields.destino?.value || "").trim();
    const statusSelecionado = safeText(fields.status?.value || "").trim();
    if (!destino) {
      setStatus("Selecione o destino antes de salvar.", "error");
      return;
    }

    const { itens, refugos } = collectItems();
    const quantidadeProgramada = Number(fields.quantidade?.value || 0);
    const now = nowForInput();

    const payload = {
      id: idInspecaoReinspecao ? Number(idInspecaoReinspecao) : 0,
      op: Number(opSelecionada || 0),
      usuario: "",
      linha: linhaSelecionada,
      codigo: Number(codigoSelecionado || 0),
      descricao: fields.descricao?.value || "",
      quantidade: quantidadeProgramada,
      data_hora_inicio_inspecao: nowOrSaved(fields.inicio?.value),
      data_hora_fim_inspecao: now,
      possui_op: true,
      qtd_etiquetas: itens.length || 1,
      status: statusSelecionado || "Em análise",
      conformidade: !!fields.conformidade?.checked,
      refugo: !!refugoToggle?.checked,
      aprovado: fields.resultado?.value === "true",
      resultado: fields.resultado?.value === "true" ? "Aprovado" : "Reprovado",
      tipo_inspecao: "manual",
      observacao: fields.observacao?.value || "",
      itens_inspecionados: itens,
      refugos: refugoToggle?.checked ? refugos : [],
      codigo_nc: fields.codigoNc?.value || refugos[0]?.codigo_nc || "",
      destino,
      quantidade_programada: quantidadeProgramada,
      inspecao_completa: fields.resultado?.value === "true",
      quantidade_nc: Number(fields.quantidadeNc?.value || 0) || refugos.reduce((acc, item) => acc + Number(item.quantidade || 0), 0),
      codigo_item: itens[0]?.codigo || Number(codigoSelecionado || 0),
      descricao_item: itens[0]?.descricao || fields.descricao?.value || "",
      sem_fim: fields.semFim?.value || "",
      central: fields.central?.value || "",
      inspecoes: Number(fields.inspecoes?.value || 0),
      tensao: fields.tensao?.value || "",
    };

    try {
      btnSalvar && (btnSalvar.disabled = true);
      setStatus("Salvando inspeção manual...", "");

      const response = await fetch("/api/qualidade/inspecoes/salvar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.detail || "Falha ao salvar inspeção.");
      }

      setStatus("Inspeção manual salva com sucesso.", "success");
      setTimeout(() => {
        window.location.href = `/qualidade/inspecoes/linha/${encodeURIComponent(linhaSelecionada)}`;
      }, 700);
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Falha ao salvar inspeção.", "error");
    } finally {
      btnSalvar && (btnSalvar.disabled = false);
    }
  });

  const linhaDaQuery = new URLSearchParams(window.location.search).get("linha") || linhaInicial;
  if (fields.linha && linhaDaQuery) {
    fields.linha.value = linhaDaQuery;
  }
  if (lineChip) {
    lineChip.textContent = linhaDaQuery || "Linha não informada";
  }
  if (fields.inicio) {
    fields.inicio.value = nowForInput();
  }
  if (fields.fim) {
    fields.fim.value = "";
  }

  if (idInspecaoReinspecao) {
    carregarInspecaoAnterior(idInspecaoReinspecao);
  }
});
