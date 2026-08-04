document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page || "";
  const status = document.querySelector("#statusMessage");
  let openQualityRefugoModal = null;

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

  function formatDateTime(value) {
    if (!value) {
      return "-";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return safeText(value);
    }

    return parsed.toLocaleString("pt-BR");
  }

  function nowForInput() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
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

  function createCard({ eyebrow, title, description, meta = [], actionLabel, onClick, actionOnClick }) {
    const card = document.createElement("article");
    card.className = "quality-card quality-card--clickable";

    if (onClick) {
      card.addEventListener("click", onClick);
    }

    const eyebrowEl = document.createElement("p");
    eyebrowEl.className = "quality-card__eyebrow";
    eyebrowEl.textContent = eyebrow;

    const titleEl = document.createElement("h3");
    titleEl.textContent = title;

    const descriptionEl = document.createElement("p");
    descriptionEl.textContent = description;

    const metaWrap = document.createElement("div");
    metaWrap.className = "quality-card__meta";

    meta.forEach((item) => {
      const pill = document.createElement("span");
      pill.className = "quality-pill";
      pill.textContent = item;
      metaWrap.appendChild(pill);
    });

    card.append(eyebrowEl, titleEl, descriptionEl, metaWrap);

    if (actionLabel) {
      const action = document.createElement("button");
      action.type = "button";
      action.className = "primary-button";
      action.textContent = actionLabel;
      if (actionOnClick) {
        action.addEventListener("click", (event) => {
          event.stopPropagation();
          actionOnClick(event);
        });
      }
      card.appendChild(action);
    }

    return card;
  }

  function nowOrSaved(value) {
    return value || nowForInput();
  }

  async function initHomePage() {
    const modal = document.querySelector("#modalLinhas");
    const btnAbrirModal = document.querySelector("#btnAbrirModalLinhas");
    const secaoCards = document.querySelector("#secaoCards");
    const linhaCards = document.querySelector("#linhaCards");
    const btnVoltarSecoes = document.querySelector("#btnVoltarSecoes");
    const modalTitle = document.querySelector("#modalTitle");
    const modalHint = document.querySelector("#modalHint");
    const statSecoes = document.querySelector("#statSecoes");
    const statLinhas = document.querySelector("#statLinhas");
    const statOps = document.querySelector("#statOps");

    let secoes = [];

    function openModal() {
      modal?.classList.remove("hidden");
      modal?.setAttribute("aria-hidden", "false");
    }

    function closeModal() {
      modal?.classList.add("hidden");
      modal?.setAttribute("aria-hidden", "true");
    }

    function renderSections() {
      if (!secaoCards) {
        return;
      }

      secaoCards.innerHTML = "";
      linhaCards && (linhaCards.innerHTML = "");
      linhaCards?.classList.add("hidden");
      secaoCards?.classList.remove("hidden");
      modal?.classList.remove("quality-modal--lines");
      btnVoltarSecoes && (btnVoltarSecoes.hidden = true);
      modalTitle && (modalTitle.textContent = "Selecione uma seção");
      modalHint && (modalHint.textContent = "Clique em uma seção para ver as linhas disponíveis.");

      if (!secoes.length) {
        const empty = document.createElement("div");
        empty.className = "quality-empty";
        empty.textContent = "Nenhuma seção encontrada na base de configuração.";
        secaoCards.appendChild(empty);
        return;
      }

      secoes.forEach((secao) => {
        const card = createCard({
          eyebrow: "Seção",
          title: secao.titulo,
          description: `${secao.quantidade_linhas} linhas cadastradas nesta seção.`,
          meta: [
            `${secao.quantidade_ops} OPs ativas`,
            `${secao.quantidade_linhas} linhas`,
          ],
          actionLabel: "Abrir linhas",
          onClick: () => renderLines(secao),
        });

        secaoCards.appendChild(card);
      });
    }

    function renderLines(secao) {
      if (!linhaCards || !secaoCards) {
        return;
      }

      modal?.classList.add("quality-modal--lines");
      linhaCards.classList.remove("hidden");
      btnVoltarSecoes && (btnVoltarSecoes.hidden = false);
      modalTitle && (modalTitle.textContent = secao.titulo);
      modalHint && (modalHint.textContent = "Clique em uma linha para abrir a página da OP.");

      linhaCards.innerHTML = "";

      if (!secao.linhas.length) {
        const empty = document.createElement("div");
        empty.className = "quality-empty";
        empty.textContent = "Nenhuma linha cadastrada para esta seção.";
        linhaCards.appendChild(empty);
        return;
      }

      secao.linhas.forEach((linha) => {
        const opAtual = linha.op_atual;
        const meta = [`${linha.quantidade_ops} OPs selecionadas`];

        if (opAtual) {
          meta.push(`OP atual: ${opAtual.op}`);
        }

        const card = createCard({
          eyebrow: secao.titulo,
          title: linha.celula_linha,
          description: opAtual
            ? `${opAtual.codigo} - ${opAtual.descricao}`
            : "Sem OP ativa no momento.",
          meta,
          actionLabel: "Abrir linha",
          onClick: () => {
            window.location.href = `/qualidade/inspecoes/linha/${encodeURIComponent(linha.celula_linha)}`;
          },
        });

        linhaCards.appendChild(card);
      });
    }

    async function carregarSecoes() {
      try {
        setStatus("Carregando seções...", "");
        const dados = await fetchJson("/api/qualidade/inspecoes/secoes");
        secoes = Array.isArray(dados) ? dados : [];

        const totalLinhas = secoes.reduce((acc, secao) => acc + (secao.quantidade_linhas || 0), 0);
        const totalOps = secoes.reduce((acc, secao) => acc + (secao.quantidade_ops || 0), 0);

        if (statSecoes) statSecoes.textContent = String(secoes.length);
        if (statLinhas) statLinhas.textContent = String(totalLinhas);
        if (statOps) statOps.textContent = String(totalOps);

        renderSections();
        setStatus(`Base carregada com ${secoes.length} seções.`, "success");
      } catch (error) {
        console.error(error);
        setStatus("Não foi possível carregar as seções.", "error");
      }
    }

    btnAbrirModal?.addEventListener("click", () => {
      openModal();
      renderSections();
    });

    modal?.querySelectorAll("[data-close-modal]").forEach((button) => {
      button.addEventListener("click", closeModal);
    });

    btnVoltarSecoes?.addEventListener("click", renderSections);

    carregarSecoes();
  }

  async function initLinhaPage() {
    const linha = document.body.dataset.linha || "";
    const titulo = document.querySelector("#linhaTitulo");
    const subtitulo = document.querySelector("#linhaSubtitulo");
    const count = document.querySelector("#linhaCount");
    const opsGrid = document.querySelector("#opsGrid");

    try {
      setStatus("Carregando OPs da linha...", "");
      const dados = await fetchJson(`/api/qualidade/inspecoes/linha/${encodeURIComponent(linha)}`);

      if (titulo) titulo.textContent = `Linha ${safeText(dados.linha || linha)}`;
      if (subtitulo) subtitulo.textContent = "Selecione a OP para abrir a inspeção.";
      if (count) count.textContent = `${dados.quantidade_ops || 0} ops`;

      opsGrid.innerHTML = "";

      const ops = Array.isArray(dados.ops) ? dados.ops : [];
      if (!ops.length) {
        const empty = document.createElement("div");
        empty.className = "quality-empty";
        empty.textContent = "Nenhuma OP ativa nessa linha.";
        opsGrid.appendChild(empty);
        setStatus("Nenhuma OP encontrada.", "");
        return;
      }

      ops.forEach((op) => {
        const meta = [
          `${op.quantidade || 0} un.`,
          op.status || "Não conferido",
        ];

        if (op.data_ultima_conferencia) {
          meta.push(formatDateTime(op.data_ultima_conferencia));
        }

        const card = createCard({
          eyebrow: `Fila ${op.fila || "-"}`,
          title: `OP ${op.op}`,
          description: `${op.codigo} - ${op.descricao}`,
          meta,
          actionLabel: "Abrir OP",
          onClick: () => {
            window.location.href = `/qualidade/inspecoes/op/${op.op}`;
          },
        });

        opsGrid.appendChild(card);
      });

      setStatus(`Linha carregada com ${ops.length} OPs ativas.`, "success");
    } catch (error) {
      console.error(error);
      setStatus("Não foi possível carregar as OPs da linha.", "error");
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
    `;

    const checkbox = card.querySelector(".js-item-check");
    const titleArea = card.querySelector(".quality-item-card__title");
    const updateState = () => {
      const checked = !!checkbox.checked;
      card.classList.toggle("is-selected", checked);

      if (!checked) {
        setCardRefugoState(card, {});
      }

      updateSelectedCount();
    };

    const openCardModal = () => {
      if (!checkbox?.checked) {
        checkbox.checked = true;
        updateState();
      }

      openQualityRefugoModal?.(card);
    };

    titleArea?.addEventListener("click", openCardModal);
    titleArea?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openCardModal();
      }
    });

    checkbox?.addEventListener("change", () => {
      updateState();
    });

    return card;
  }

  function updateSelectedCount() {
    const countEl = document.querySelector("#itensSelecionadosCount");
    const total = document.querySelectorAll(".quality-item-card .js-item-check:checked").length;
    if (countEl) {
      countEl.textContent = `${total} selecionados`;
    }
  }

  function setCardRefugoState(card, data = {}) {
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
    updateSelectedCount();
  }

  function createItemListRenderer(container) {
    return (itens = []) => {
      if (!container) {
        return [];
      }

      container.innerHTML = "";

      if (!itens.length) {
        const empty = document.createElement("div");
        empty.className = "quality-empty";
        empty.textContent = "Nenhum item disponível.";
        container.appendChild(empty);
        updateSelectedCount();
        return [];
      }

      const cards = [];
      itens.forEach((item, index) => {
        const card = createItemCard(item, index);
        setCardRefugoState(card, {});
        container.appendChild(card);
        cards.push(card);
      });

      updateSelectedCount();
      return cards;
    };
  }

  async function initOpPage() {
    const op = document.body.dataset.op || "";
    const form = document.querySelector("#inspecaoForm");
    const itensLista = document.querySelector("#itensInspecionados");
    const refugoToggle = document.querySelector("#fRefugo");
    const btnSalvar = document.querySelector("#btnSalvarInspecao");
    const lineChip = document.querySelector("#opLinhaChip");
    const opTitle = document.querySelector("#opTitulo");
    const visualDescricao = document.querySelector("#fDescricaoVisual");
    const opHighlight = document.querySelector("#opDestaque");
    const codeHighlight = document.querySelector("#codigoDestaque");
    const qtyHighlight = document.querySelector("#quantidadeDestaque");
    const itemModal = document.querySelector("#itemRefugoModal");
    const itemModalTitle = document.querySelector("#itemRefugoTitle");
    const itemModalDescricao = document.querySelector("#itemRefugoDescricao");
    const itemModalLinha = document.querySelector("#itemRefugoLinha");
    const itemModalQuantidade = document.querySelector("#itemRefugoQuantidade");
    const itemModalCodigoNc = document.querySelector("#itemRefugoCodigoNc");
    const itemModalObservacao = document.querySelector("#itemRefugoObservacao");
    const btnSalvarItemRefugo = document.querySelector("#btnSalvarItemRefugo");
    const btnLimparItemRefugo = document.querySelector("#btnLimparItemRefugo");
    let linhaInspecao = "";
    let cardRefugoAtivo = null;

    const fields = {
      op: document.querySelector("#fOp"),
      codigo: document.querySelector("#fCodigo"),
      descricao: document.querySelector("#fDescricao"),
      quantidade: document.querySelector("#fQuantidade"),
      inicio: document.querySelector("#fInicio"),
      fim: document.querySelector("#fFim"),
      status: document.querySelector("#fStatus"),
      resultado: document.querySelector("#fResultado"),
      conformidade: document.querySelector("#fConformidade"),
      observacao: document.querySelector("#fObservacao"),
    };

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

    function setCardRefugoState(card, data = {}) {
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
      updateSelectedCount();
    }

    function openItemRefugoModal(card) {
      if (!itemModal || !card) {
        return;
      }

      cardRefugoAtivo = card;
      const titulo = card.dataset.titulo || "Item";
      const descricao = card.dataset.valor || "";

      if (itemModalTitle) itemModalTitle.textContent = titulo;
      if (itemModalDescricao) itemModalDescricao.textContent = descricao || "Sem descrição adicional";
      if (itemModalLinha) itemModalLinha.textContent = linhaInspecao ? `Linha ${linhaInspecao}` : "Linha -";
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

      setCardRefugoState(cardRefugoAtivo, {
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
        setCardRefugoState(cardRefugoAtivo, {});
      }
    }

    function collectItems() {
      const cards = Array.from(document.querySelectorAll("#itensInspecionados .quality-item-card"));
      const itens = [];
      const refugos = [];

      cards.forEach((card) => {
        const checkbox = card.querySelector(".js-item-check");
        const checked = !!checkbox?.checked;
        if (!checked) {
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

    async function carregarDadosOp() {
      try {
        setStatus("Carregando dados da OP...", "");
        const dados = await fetchJson(`/api/qualidade/inspecoes/op/${op}`);

        const codigoPai = Number(dados.codigo || 0);
        const descricao = safeText(dados.descricao || "");
        const quantidade = Number(dados.quantidade || 0);

        linhaInspecao = safeText(dados.linha || "");
        if (opTitle) opTitle.textContent = `${linhaInspecao || "OP não encontrada"}`;
        if (lineChip) lineChip.textContent = linhaInspecao || "Linha não informada";
        if (opHighlight) opHighlight.textContent = safeText(dados.op || op);
        if (codeHighlight) codeHighlight.textContent = String(codigoPai || "-");
        if (qtyHighlight) qtyHighlight.textContent = String(quantidade || "-");
        if (visualDescricao) visualDescricao.textContent = safeText(dados.descricao);

        if (fields.op) fields.op.value = safeText(dados.op || op);
        if (fields.codigo) fields.codigo.value = String(codigoPai || "");
        if (fields.descricao) fields.descricao.value = descricao;
        if (fields.quantidade) fields.quantidade.value = String(quantidade || "");
        if (fields.inicio) fields.inicio.value = nowForInput();
        if (fields.fim) fields.fim.value = "";
        if (fields.observacao) fields.observacao.value = dados.observacao || "";
        setSelectValue(fields.status, dados.status || dados.status_qualidade || "Em análise");
        setSelectValue(fields.resultado, dados.resultado === "Reprovado" ? "false" : "true");

        itensLista.innerHTML = "";
        const itensDisponiveis = Array.isArray(dados.itens_disponiveis) ? dados.itens_disponiveis : [];
        if (!itensDisponiveis.length) {
          const empty = document.createElement("div");
          empty.className = "quality-empty";
          empty.textContent = "Nenhum item disponível para esta OP.";
          itensLista.appendChild(empty);
        } else {
          itensDisponiveis.forEach((item, index) => {
            const card = createItemCard(item, index);
            setCardRefugoState(card, {});
            itensLista.appendChild(card);
          });
        }

        updateSelectedCount();

        setStatus("Dados da OP carregados.", "success");
      } catch (error) {
        console.error(error);
        setStatus("Não foi possível carregar os dados da OP.", "error");
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

    openQualityRefugoModal = openItemRefugoModal;

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();

      const { itens, refugos } = collectItems();
      const now = nowForInput();
      const payload = {
        op: Number(fields.op?.value || op || 0),
        usuario: "",
        linha: lineChip?.textContent || "",
        codigo: Number(fields.codigo?.value || 0),
        descricao: fields.descricao?.value || "",
        quantidade: Number(fields.quantidade?.value || 0),
        data_hora_inicio_inspecao: nowOrSaved(fields.inicio?.value),
        data_hora_fim_inspecao: now,
        possui_op: true,
        qtd_etiquetas: 0,
        status: document.querySelector("#fStatus")?.value || "",
        conformidade: !!fields.conformidade?.checked,
        refugo: !!refugoToggle?.checked,
        aprovado: document.querySelector("#fResultado")?.value === "true",
        resultado: document.querySelector("#fResultado")?.value === "true" ? "Aprovado" : "Reprovado",
        tipo_inspecao: "",
        observacao: fields.observacao?.value || "",
        itens_inspecionados: itens,
        refugos: refugoToggle?.checked ? refugos : [],
        codigo_nc: refugos[0]?.codigo_nc || "",
      };

      try {
        btnSalvar && (btnSalvar.disabled = true);
        setStatus("Salvando inspeção...", "");

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

        setStatus("Inspeção salva com sucesso.", "success");
        setTimeout(() => {
          window.location.href = `/qualidade/inspecoes/linha/${encodeURIComponent(linhaInspecao || lineChip?.textContent || "")}`;
        }, 600);
      } catch (error) {
        console.error(error);
        setStatus(error.message || "Falha ao salvar inspeção.", "error");
      } finally {
        btnSalvar && (btnSalvar.disabled = false);
      }
    });

    await carregarDadosOp();
  }

  async function initManualPage() {
    const linha = document.body.dataset.linha || "";
    const form = document.querySelector("#inspecaoForm");
    const lineChip = document.querySelector("#manualLinhaChip");
    const itensLista = document.querySelector("#itensInspecionados");
    const btnBuscarOp = document.querySelector("#btnBuscarOp");
    const btnBuscarProduto = document.querySelector("#btnBuscarProduto");
    const btnAdicionarItemBase = document.querySelector("#btnAdicionarItemBase");
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
    const itensRender = createItemListRenderer(itensLista);
    const idInspecaoReinspecao = new URLSearchParams(window.location.search).get("id_inspecao") || "";
    let cardRefugoAtivo = null;
    let produtoCarregado = false;
    let codigoCarregandoTimer = null;

    const fields = {
      linha: document.querySelector("#fLinha"),
      op: document.querySelector("#fOp"),
      codigo: document.querySelector("#fCodigo"),
      descricao: document.querySelector("#fDescricao"),
      quantidade: document.querySelector("#fQuantidade"),
      destino: document.querySelector("#fDestino"),
      inicio: document.querySelector("#fInicio"),
      fim: document.querySelector("#fFim"),
      quantidadeProgramada: document.querySelector("#fQuantidadeProgramada"),
      quantidadeNc: document.querySelector("#fQuantidadeNc"),
      codigoNc: document.querySelector("#fCodigoNc"),
      semFim: document.querySelector("#fSemFim"),
      central: document.querySelector("#fCentral"),
      inspecoes: document.querySelector("#fInspecoes"),
      tensao: document.querySelector("#fTensao"),
      status: document.querySelector("#fStatus"),
      resultado: document.querySelector("#fResultado"),
      conformidade: document.querySelector("#fConformidade"),
      refugo: document.querySelector("#fRefugo"),
      observacao: document.querySelector("#fObservacao"),
      novoItemCodigo: document.querySelector("#novoItemCodigo"),
      novoItemDescricao: document.querySelector("#novoItemDescricao"),
    };

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

    function normalizarChaveItem(item = {}) {
      return [
        safeText(item.codigo_pai || item.codigo || ""),
        safeText(item.campo || ""),
        safeText(item.titulo || item.descricao || item.valor || ""),
      ]
        .join("|")
        .trim()
        .toLowerCase();
    }

    function renderizarItensManuais(itens = [], { selecionarTodos = false, refugos = [] } = {}) {
      const cards = itensRender(Array.isArray(itens) ? itens : []);
      const refugosMap = new Map((Array.isArray(refugos) ? refugos : []).map((refugo) => [normalizarChaveItem(refugo), refugo]));

      cards.forEach((card, index) => {
        const item = itens[index] || {};
        const checkbox = card.querySelector(".js-item-check");
        const refugo = refugosMap.get(normalizarChaveItem(item));

        if (checkbox && selecionarTodos) {
          checkbox.checked = true;
          checkbox.dispatchEvent(new Event("change"));
        }

        if (refugo) {
          setCardState(card, {
            quantidade: Number(refugo.quantidade || 0),
            codigoNc: refugo.codigo_nc || refugo.codigoNc || "",
            observacao: refugo.observacao || "",
          });

          if (checkbox && !checkbox.checked) {
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event("change"));
          }
        }
      });

      updateSelectedCount();
      return cards;
    }

    function syncHiddenFields(produto = {}) {
      if (fields.quantidadeProgramada) {
        fields.quantidadeProgramada.value = String(produto.quantidade || fields.quantidade?.value || "0");
      }
      if (fields.semFim) fields.semFim.value = safeText(produto.sem_fim || "");
      if (fields.central) fields.central.value = safeText(produto.central || "");
      if (fields.tensao) fields.tensao.value = safeText(produto.tensao || "");
      if (fields.inspecoes) fields.inspecoes.value = "0";
      if (fields.codigoNc) fields.codigoNc.value = "";
      if (fields.quantidadeNc) fields.quantidadeNc.value = "0";
    }

    async function carregarLinhasDisponiveis() {
      if (!fields.linha) {
        return;
      }

      const linhaPreselecionada = safeText(linha || fields.linha.value || "").trim();

      try {
        const secoes = await fetchJson("/api/qualidade/inspecoes/secoes");
        const linhas = [];
        const vistos = new Set();

        (Array.isArray(secoes) ? secoes : []).forEach((secao) => {
          (Array.isArray(secao.linhas) ? secao.linhas : []).forEach((item) => {
            const valorLinha = safeText(item.celula_linha || "").trim();
            if (!valorLinha) {
              return;
            }

            const chave = valorLinha.toLowerCase();
            if (vistos.has(chave)) {
              return;
            }

            vistos.add(chave);
            linhas.push({
              value: valorLinha,
              label: `${safeText(secao.titulo || secao.secao || "Linha")} - ${valorLinha}`,
            });
          });
        });

        const opcoes = [`<option value="">Selecione a linha</option>`]
          .concat(linhas.map((item) => `<option value="${item.value}">${item.label}</option>`))
          .join("");
        fields.linha.innerHTML = opcoes;

        if (linhaPreselecionada) {
          fields.linha.value = linhaPreselecionada;
        } else if (linhas.length) {
          fields.linha.value = linhas[0].value;
        }

        if (lineChip) {
          lineChip.textContent = fields.linha.value || linha || "Linha não informada";
        }
      } catch (error) {
        console.error(error);
        if (linhaPreselecionada) {
          fields.linha.innerHTML = `<option value="${linhaPreselecionada}">${linhaPreselecionada}</option>`;
          fields.linha.value = linhaPreselecionada;
        }

        if (lineChip) {
          lineChip.textContent = fields.linha.value || linha || "Linha não informada";
        }
      }
    }

    function setCardState(card, data = {}) {
      setCardRefugoState(card, data);
    }

    function openItemRefugoModal(card) {
      if (!itemModal || !card) {
        return;
      }

      cardRefugoAtivo = card;
      const titulo = card.dataset.titulo || "Item";
      const descricao = card.dataset.valor || "";
      if (itemModalTitle) itemModalTitle.textContent = titulo;
      if (itemModalDescricao) itemModalDescricao.textContent = descricao || "Sem descrição adicional";
      if (itemModalLinha) itemModalLinha.textContent = linha ? `Linha ${linha}` : "Linha -";
      if (itemModalQuantidade) itemModalQuantidade.value = String(card.dataset.refugoQuantidade || "0");
      if (itemModalCodigoNc) itemModalCodigoNc.value = card.dataset.refugoCodigoNc || "";
      if (itemModalObservacao) itemModalObservacao.value = card.dataset.refugoObservacao || "";

      itemModal.classList.remove("hidden");
      itemModal.setAttribute("aria-hidden", "false");
      itemModalQuantidade?.focus();
    }

    function closeItemRefugoModal() {
      itemModal?.classList.add("hidden");
      itemModal?.setAttribute("aria-hidden", "true");
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

      if (fields.refugo) {
        fields.refugo.checked = document.querySelectorAll('.quality-item-card[data-refugo="1"]').length > 0;
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

    async function carregarProdutoPorCodigo(codigo) {
      const codigoTexto = safeText(codigo).trim();
      if (!codigoTexto) {
        setStatus("Digite um código para carregar o produto.", "");
        return null;
      }

      try {
        setStatus("Carregando produto...", "");
        const produto = await fetchJson(`/api/qualidade/inspecoes/produto/${encodeURIComponent(codigoTexto)}`);
        produtoCarregado = true;

        if (fields.codigo) fields.codigo.value = String(produto.codigo || codigoTexto);
        if (fields.descricao) fields.descricao.value = produto.descricao || "";
        if (fields.quantidade && !fields.quantidade.value) fields.quantidade.value = String(produto.quantidade || 0);
        if (fields.linha && !fields.linha.value) fields.linha.value = linha;
        syncHiddenFields(produto);

        if (lineChip) lineChip.textContent = linha || produto.linha || "Linha não informada";
        itensRender(Array.isArray(produto.itens_disponiveis) ? produto.itens_disponiveis : []);

        setStatus("Produto carregado.", "success");
        return produto;
      } catch (error) {
        console.error(error);
        produtoCarregado = false;
        syncHiddenFields({});
        itensRender([]);
        setStatus(error.message || "Produto não encontrado. Você pode preencher manualmente.", "error");
        return null;
      }
    }

    async function carregarOpPorNumero(numeroOp) {
      const opTexto = safeText(numeroOp).trim();
      if (!opTexto) {
        setStatus("Digite uma OP para carregar a inspeção.", "");
        return null;
      }

      try {
        setStatus("Carregando OP...", "");
        const dados = await fetchJson(`/api/qualidade/inspecoes/op/${encodeURIComponent(opTexto)}`);
        produtoCarregado = true;

        if (fields.op) fields.op.value = String(dados.op || opTexto);
        if (fields.codigo) fields.codigo.value = String(dados.codigo || "");
        if (fields.descricao) fields.descricao.value = dados.descricao || "";
        if (fields.quantidade) fields.quantidade.value = String(dados.quantidade || 0);
        if (fields.linha && !fields.linha.value) fields.linha.value = dados.linha || linha;
        syncHiddenFields(dados);

        if (lineChip) lineChip.textContent = linha || dados.linha || "Linha não informada";
        renderizarItensManuais(Array.isArray(dados.itens_disponiveis) ? dados.itens_disponiveis : []);

        setStatus("OP carregada.", "success");
        return dados;
      } catch (error) {
        console.error(error);
        produtoCarregado = false;
        setStatus("OP não localizada no sistema. Você pode continuar preenchendo manualmente ou carregar pelo código.", "error");
        return null;
      }
    }

    async function carregarDadosManuais() {
      const linhaSelecionada = safeText(fields.linha?.value || "").trim();
      const codigoTexto = safeText(fields.codigo?.value || "").trim();

      if (!linhaSelecionada) {
        setStatus("Selecione a linha antes de carregar os dados.", "error");
        return null;
      }

      if (codigoTexto) {
        if (fields.linha) {
          fields.linha.value = linhaSelecionada;
        }
        return carregarProdutoPorCodigo(codigoTexto);
      }

      setStatus("Digite o código do produto para carregar descrição e itens. A OP pode ser preenchida manualmente.", "");
      return null;
    }

    async function carregarInspecaoParaReinspecao(idInspecao) {
      if (!idInspecao) {
        return;
      }

      try {
        setStatus("Carregando inspeção anterior...", "");
        const dados = await fetchJson(`/api/qualidade/inspecoes/dados/${encodeURIComponent(idInspecao)}`);

        if (fields.linha && dados.linha) fields.linha.value = dados.linha;
        if (fields.op && dados.op) fields.op.value = String(dados.op);
        if (fields.codigo && dados.codigo) fields.codigo.value = String(dados.codigo);
        if (fields.descricao && dados.descricao) fields.descricao.value = dados.descricao;
        if (fields.quantidade && dados.quantidade_programada) fields.quantidade.value = String(dados.quantidade_programada);
        if (fields.destino && dados.destino) fields.destino.value = dados.destino;
        setSelectValue(fields.status, dados.status || "Em análise");
        setSelectValue(fields.resultado, dados.inspecao_completa ? "true" : "false");
        if (fields.observacao) fields.observacao.value = dados.observacao || "";
        if (fields.semFim) fields.semFim.value = dados.sem_fim || "";
        if (fields.central) fields.central.value = dados.central || "";
        if (fields.tensao) fields.tensao.value = dados.tensao || "";
        if (fields.codigoNc) fields.codigoNc.value = dados.codigo_nc || "";
        if (fields.quantidadeNc) fields.quantidadeNc.value = String(dados.quantidade_nc || 0);
        if (fields.quantidadeProgramada) fields.quantidadeProgramada.value = String(dados.quantidade_programada || "");

        const itensInspecionados = Array.isArray(dados.itens_inspecionados) ? dados.itens_inspecionados : [];
        const refugos = Array.isArray(dados.refugos) ? dados.refugos : [];

        if (itensInspecionados.length) {
          renderizarItensManuais(itensInspecionados, {
            selecionarTodos: true,
            refugos,
          });
        } else if (dados.codigo) {
          await carregarProdutoPorCodigo(dados.codigo);
        }

        if (dados.descricao_item) {
          const card = createItemCard(
            {
              codigo_pai: dados.codigo_item || dados.codigo || 0,
              campo: "manual",
              titulo: dados.descricao_item,
              valor: dados.descricao_item,
            },
            0,
          );
          setCardState(card, {});
          itensLista.appendChild(card);
          const checkbox = card.querySelector(".js-item-check");
          if (checkbox) {
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event("change"));
          }
        }

        setStatus("Inspeção anterior carregada.", "success");
      } catch (error) {
        console.error(error);
        setStatus("Não foi possível carregar a inspeção anterior.", "error");
      }
    }

    async function adicionarItemManualNaBase() {
      const produtoCodigo = fields.codigo?.value?.trim() || "";
      const codigoItem = fields.novoItemCodigo?.value?.trim() || produtoCodigo;
      const descricaoItem = fields.novoItemDescricao?.value?.trim() || "";

      if (!produtoCodigo || !descricaoItem) {
        setStatus("Informe o código do produto e a descrição do item.", "error");
        return;
      }

      try {
        await fetchJson("/api/qualidade/inspecoes/base-item", {
          method: "POST",
          body: JSON.stringify({
            codigo: produtoCodigo,
            descricao_item: descricaoItem,
          }),
        });

        const card = createItemCard(
          {
            codigo_pai: codigoItem,
            campo: "manual",
            titulo: descricaoItem,
            valor: descricaoItem,
          },
          document.querySelectorAll("#itensInspecionados .quality-item-card").length,
        );

        itensLista.appendChild(card);
        const checkbox = card.querySelector(".js-item-check");
        if (checkbox) {
          checkbox.checked = true;
          checkbox.dispatchEvent(new Event("change"));
        }

        openQualityRefugoModal?.(card);
        if (fields.novoItemCodigo) fields.novoItemCodigo.value = "";
        if (fields.novoItemDescricao) fields.novoItemDescricao.value = "";
        setStatus("Item adicionado à base e marcado para inspeção.", "success");
      } catch (error) {
        console.error(error);
        setStatus(error.message || "Não foi possível adicionar o item na base.", "error");
      }
    }

    function collectManualPayload() {
      const { itens, refugos } = (function collectItemsFromPage() {
        const cards = Array.from(document.querySelectorAll("#itensInspecionados .quality-item-card"));
        const itens = [];
        const refugos = [];

        cards.forEach((card) => {
          const checkbox = card.querySelector(".js-item-check");
          const checked = !!checkbox?.checked;
          if (!checked) {
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
      })();

      const codigoSelecionado = Number(fields.codigo?.value || 0);
      const descricaoSelecionada = fields.descricao?.value || "";
      const quantidadeSelecionada = Number(fields.quantidade?.value || 0);
      const quantidadeNc = Number(fields.quantidadeNc?.value || 0);
      const codigoNc = fields.codigoNc?.value || "";

      return {
        payload: {
          op: Number(fields.op?.value || 0),
          usuario: "",
          linha: fields.linha?.value || linha || "",
          codigo: codigoSelecionado,
          descricao: descricaoSelecionada,
          quantidade: quantidadeSelecionada,
          data_hora_inicio_inspecao: nowOrSaved(fields.inicio?.value),
          data_hora_fim_inspecao: nowForInput(),
          possui_op: true,
          qtd_etiquetas: itens.length || 1,
          status: fields.status?.value || "",
          conformidade: !!fields.conformidade?.checked,
          refugo: !!fields.refugo?.checked,
          aprovado: fields.resultado?.value === "true",
          resultado: fields.resultado?.value === "true" ? "Aprovado" : "Reprovado",
          tipo_inspecao: "manual",
          observacao: fields.observacao?.value || "",
          itens_inspecionados: itens,
          refugos: fields.refugo?.checked ? refugos : [],
          codigo_nc: codigoNc || refugos[0]?.codigo_nc || "",
          destino: fields.destino?.value || "",
          quantidade_programada: Number(fields.quantidadeProgramada?.value || quantidadeSelecionada || 0),
          inspecao_completa: fields.resultado?.value === "true",
          quantidade_nc: quantidadeNc || refugos.reduce((acc, item) => acc + Number(item.quantidade || 0), 0),
          codigo_item: itens[0]?.codigo || codigoSelecionado,
          descricao_item: itens[0]?.descricao || descricaoSelecionada,
          sem_fim: fields.semFim?.value || "",
          central: fields.central?.value || "",
          inspecoes: Number(fields.inspecoes?.value || 0),
          tensao: fields.tensao?.value || "",
        },
        itens,
        refugos,
      };
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

    openQualityRefugoModal = openItemRefugoModal;

    btnBuscarProduto?.addEventListener("click", () => {
      carregarProdutoPorCodigo(fields.codigo?.value || "");
    });
    btnBuscarOp?.addEventListener("click", () => {
      carregarDadosManuais();
    });
    fields.linha?.addEventListener("change", () => {
      if (lineChip) {
        lineChip.textContent = fields.linha?.value || linha || "Linha não informada";
      }
    });
    fields.op?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        fields.codigo?.focus();
      }
    });
    fields.codigo?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        carregarDadosManuais();
      }
    });
    fields.codigo?.addEventListener("input", () => {
      if (codigoCarregandoTimer) {
        window.clearTimeout(codigoCarregandoTimer);
      }

      const valor = safeText(fields.codigo?.value || "").trim();
      if (!valor) {
        return;
      }

      codigoCarregandoTimer = window.setTimeout(() => {
        carregarDadosManuais();
      }, 500);
    });
    fields.codigo?.addEventListener("blur", () => {
      carregarDadosManuais();
    });
    btnAdicionarItemBase?.addEventListener("click", adicionarItemManualNaBase);

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();

      const linhaSelecionada = safeText(fields.linha?.value || "").trim();
      const opSelecionada = safeText(fields.op?.value || "").trim();
      const codigoSelecionadoTexto = safeText(fields.codigo?.value || "").trim();
      if (!linhaSelecionada || !opSelecionada || !codigoSelecionadoTexto) {
        setStatus("Selecione a linha e preencha a OP e o código antes de salvar.", "error");
        return;
      }

      const { payload } = collectManualPayload();

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
          window.location.href = "/qualidade/inspecoes/dia";
        }, 700);
      } catch (error) {
        console.error(error);
        setStatus(error.message || "Falha ao salvar inspeção.", "error");
      } finally {
        btnSalvar && (btnSalvar.disabled = false);
      }
    });

    if (idInspecaoReinspecao) {
      await carregarInspecaoParaReinspecao(idInspecaoReinspecao);
    } else {
      await carregarLinhasDisponiveis();
      syncHiddenFields({});
      if (fields.linha && !fields.linha.value && linha) fields.linha.value = linha;
      if (lineChip) lineChip.textContent = fields.linha?.value || linha || "Linha não informada";
      if (fields.inicio) fields.inicio.value = nowForInput();
      if (fields.fim) fields.fim.value = "";
    }
  }

  async function initDiaPage() {
    const lista = document.querySelector("#inspecoesDiaLista");
    const count = document.querySelector("#diaCount");
    const modal = document.querySelector("#inspecaoDiaModal");
    const modalTitulo = document.querySelector("#diaModalTitle");
    const modalResumo = document.querySelector("#diaModalResumo");
    const modalLista = document.querySelector("#diaModalLista");
    const modalCount = document.querySelector("#diaModalCount");
    const btnConferirNovamente = document.querySelector("#btnConferirNovamenteDia");
    let registroAtivo = null;
    let detalheAtivo = null;

    function closeDiaModal() {
      modal?.classList.add("hidden");
      modal?.setAttribute("aria-hidden", "true");
      registroAtivo = null;
      detalheAtivo = null;
      if (btnConferirNovamente) {
        btnConferirNovamente.href = "#";
      }
    }

    modal?.querySelectorAll("[data-close-dia-modal]").forEach((button) => {
      button.addEventListener("click", closeDiaModal);
    });

    modal?.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeDiaModal();
      }
    });

    function renderResumo(registro, detalhe = null) {
      if (!modalResumo) {
        return;
      }

      const itens = Array.isArray(detalhe?.conferencias) ? detalhe.conferencias : [];
      const quantidadeItens = itens.length || (Array.isArray(registro.itens_inspecionados) ? registro.itens_inspecionados.length : 0);
      const quantidadeRefugos = Number(registro.refugos || 0);

      modalResumo.innerHTML = "";

      const resumoItens = [
        { label: "OP", value: registro.op || "-" },
        { label: "Linha", value: registro.linha || "-" },
        { label: "Código", value: registro.codigo || "-" },
        { label: "Destino", value: registro.destino || "Sem destino" },
        { label: "Itens", value: quantidadeItens },
        { label: "Refugos", value: quantidadeRefugos },
      ];

      resumoItens.forEach((item) => {
        const box = document.createElement("article");
        box.className = "quality-stat";
        box.innerHTML = `
          <span>${safeText(item.label)}</span>
          <strong>${safeText(item.value)}</strong>
        `;
        modalResumo.appendChild(box);
      });
    }

    function renderConferencias(registro, detalhe = null) {
      if (!modalLista) return;
      const linhas = Array.isArray(detalhe?.linhas_relatorio) ? detalhe.linhas_relatorio : [];
      modalLista.innerHTML = "";
      if (modalCount) modalCount.textContent = `${linhas.length} ${linhas.length === 1 ? "linha" : "linhas"}`;
      if (!linhas.length) {
        const empty=document.createElement("div");
        empty.className="quality-empty";
        empty.textContent="Nenhum detalhe encontrado para esta inspecao.";
        modalLista.appendChild(empty);
        return;
      }
      const table=document.createElement("table");
      table.className="quality-report-table";
      table.innerHTML=`
        <thead><tr><th>OP</th><th>Codigo</th><th>Descricao</th><th>Quantidade</th><th>Data/hora inicio inspecao</th><th>Data/hora fim inspecao</th><th>Status</th><th>Observacao geral</th><th>Item conferido</th><th>Codigo NC</th><th>Observacao refugo</th></tr></thead>
        <tbody></tbody>
      `;
      const tbody=table.querySelector("tbody");
      linhas.forEach((item)=>{
        const row=document.createElement("tr");
        [item.op,item.codigo,item.descricao,item.quantidade,item.data_hora_inicio_inspecao,item.data_hora_fim_inspecao,item.status,item.observacao_geral,item.item_conferido,item.codigo_nc,item.observacao_refugo].forEach((value)=>{
          const cell=document.createElement("td");
          cell.textContent=value === null || value === undefined || value === "" ? "-" : String(value);
          row.appendChild(cell);
        });
        tbody.appendChild(row);
      });
      modalLista.appendChild(table);
    }

    async function openDiaModal(registro) {
      if (!modal || !registro?.id_inspecao) {
        return;
      }

      registroAtivo = registro;
      detalheAtivo = null;
      modal.classList.remove("hidden");
      modal.setAttribute("aria-hidden", "false");
      if (modalTitulo) {
        modalTitulo.textContent = `Inspeção da OP ${registro.op || "-"}`;
      }
      if (btnConferirNovamente) {
        btnConferirNovamente.href = registro.url_reinspecao || "#";
      }
      if (modalLista) {
        modalLista.innerHTML = `<div class="quality-empty">Carregando detalhes da inspeção...</div>`;
      }
      if (modalCount) {
        modalCount.textContent = "0 itens";
      }

      try {
        const detalhe = await fetchJson(`/api/qualidade/inspecoes/dados/${encodeURIComponent(registro.id_inspecao)}`);
        detalheAtivo = detalhe;
        renderResumo(registro, detalhe);
        renderConferencias(registro, detalhe);
      } catch (error) {
        console.error(error);
        renderResumo(registro, null);
        renderConferencias(registro, null);
        if (modalLista) {
          modalLista.innerHTML = `<div class="quality-empty">Não foi possível carregar os detalhes desta inspeção.</div>`;
        }
      }
    }

    try {
      setStatus("Carregando inspeções do dia...", "");
      const dados = await fetchJson("/api/qualidade/inspecoes/hoje");
      const registros = Array.isArray(dados) ? dados : [];

      if (count) count.textContent = `${registros.length} registros`;
      if (!lista) {
        return;
      }

      lista.innerHTML = "";

      if (!registros.length) {
        const empty = document.createElement("div");
        empty.className = "quality-empty";
        empty.textContent = "Nenhuma inspeção registrada hoje.";
        lista.appendChild(empty);
        setStatus("Nenhuma inspeção encontrada hoje.", "");
        return;
      }

      registros.forEach((registro) => {
        const quantidadeRefugos = Number(registro.refugos || 0);
        const card = createCard({
          eyebrow: registro.status || "Inspeção",
          title: `Linha ${registro.linha || "-"}`,
          description: `${registro.hora || "-"} | OP ${registro.op || "-"}`,
          meta: [
            `${registro.codigo || "-"} - ${registro.descricao || ""}`,
            registro.destino || "Sem destino",
            `${Number(registro.quantidade_programada || 0)} programados`,
            quantidadeRefugos ? `${quantidadeRefugos} refugos` : "Sem refugo",
          ],
          actionLabel: "Conferir novamente",
          onClick: () => openDiaModal(registro),
          actionOnClick: () => {
            window.location.href = registro.url_reinspecao || `/qualidade/inspecoes/op/${registro.op}`;
          },
        });

        lista.appendChild(card);
      });

      setStatus("Inspeções do dia carregadas.", "success");
    } catch (error) {
      console.error(error);
      setStatus("Não foi possível carregar as inspeções do dia.", "error");
    }
  }

  if (page === "qualidade-home") {
    initHomePage();
  } else if (page === "qualidade-linha") {
    initLinhaPage();
  } else if (page === "qualidade-op") {
    initOpPage();
  } else if (page === "qualidade-op-manual") {
    initManualPage();
  } else if (page === "qualidade-dia") {
    initDiaPage();
  }
});
