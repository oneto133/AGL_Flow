document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page || "";
  if (page !== "qualidade-op") {
    return;
  }

  const status = document.querySelector("#statusMessage");
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

  const fields = {
    op: document.querySelector("#fOp"),
    codigo: document.querySelector("#fCodigo"),
    descricao: document.querySelector("#fDescricao"),
    quantidade: document.querySelector("#fQuantidade"),
    destino: document.querySelector("#fDestino"),
    inicio: document.querySelector("#fInicio"),
    fim: document.querySelector("#fFim"),
    status: document.querySelector("#fStatus"),
    resultado: document.querySelector("#fResultado"),
    conformidade: document.querySelector("#fConformidade"),
    observacao: document.querySelector("#fObservacao"),
  };

  const op = document.body.dataset.op || "";
  const idInspecaoReinspecao = new URLSearchParams(window.location.search).get("id_inspecao") || "";
  let linhaInspecao = "";
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

  function normalizeStatusValue(value) {
    const normalized = normalizeText(value);
    if (["iniciado", "em analise", "em_andamento", "em andamento"].includes(normalized)) {
      return "Iniciado";
    }
    if (normalized === "pausado") {
      return "Pausado";
    }
    if (normalized === "conforme") {
      return "Conforme";
    }
    if (normalized === "nao conforme") {
      return "Não conforme";
    }
    return safeText(value).trim();
  }

  function normalizeDestinoValue(value) {
    const normalized = normalizeText(value);
    if (normalized === "true") {
      return "Nacional";
    }
    if (normalized === "false") {
      return "Exportação";
    }
    if (normalized === "exportacao") {
      return "Exportação";
    }
    if (normalized === "nacional") {
      return "Nacional";
    }
    return safeText(value).trim();
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

    const openCardModal = () => {
      if (!checkbox?.checked) {
        checkbox.checked = true;
        card.classList.add("is-selected");
        updateSelectedCount();
      }

      openItemRefugoModal(card);
    };

    const syncState = () => {
      const checked = !!checkbox?.checked;
      card.classList.toggle("is-selected", checked);
      if (!checked) {
        setCardRefugoState(card, {});
      }
      updateSelectedCount();
    };

    titleArea?.addEventListener("click", openCardModal);
    titleArea?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openCardModal();
      }
    });
    checkbox?.addEventListener("change", syncState);

    return card;
  }

  function openItemRefugoModal(card) {
    if (!itemModal || !card) {
      return;
    }

    cardRefugoAtivo = card;

    if (itemModalTitle) itemModalTitle.textContent = card.dataset.titulo || "Item";
    if (itemModalDescricao) {
      itemModalDescricao.textContent = card.dataset.valor || "Sem descrição adicional";
    }
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

  function normalizarChaveItem(item = {}) {
    return [
      safeText(item.codigo_pai || item.codigo_item || item.codigo || ""),
      safeText(item.descricao_item || item.descricao || item.titulo || ""),
      safeText(item.item_campo || item.campo || ""),
    ]
      .join("|")
      .toLowerCase();
  }

  function localizarCardPorItem(item = {}) {
    const chave = normalizarChaveItem(item);
    const cards = Array.from(document.querySelectorAll("#itensInspecionados .quality-item-card"));

    return cards.find((card) => {
      const cardChave = [
        safeText(card.dataset.codigoPai || ""),
        safeText(card.dataset.titulo || ""),
        safeText(card.dataset.campo || ""),
      ]
        .join("|")
        .toLowerCase();

      return cardChave === chave || (
        safeText(card.dataset.codigoPai || "") === safeText(item.codigo_pai || item.codigo_item || item.codigo || "") &&
        safeText(card.dataset.campo || "") === safeText(item.item_campo || item.campo || "")
      );
    }) || null;
  }

  function aplicarReinspecao(dados = {}) {
    if (fields.destino) {
      setSelectValue(fields.destino, normalizeDestinoValue(dados.destino || ""));
    }
    if (fields.status) {
      setSelectValue(fields.status, normalizeStatusValue(dados.status || dados.status_qualidade || "Iniciado"));
    }
    if (fields.resultado) {
      setSelectValue(fields.resultado, dados.inspecao_completa ? "true" : "false");
    }
    if (fields.observacao) {
      fields.observacao.value = safeText(dados.observacao || "");
    }

    const itensInspecionados = Array.isArray(dados.itens_inspecionados) ? dados.itens_inspecionados : [];
    const conferencias = Array.isArray(dados.conferencias) ? dados.conferencias : [];

    itensInspecionados.forEach((item) => {
      const card = localizarCardPorItem(item);
      if (!card) {
        return;
      }

      const checkbox = card.querySelector(".js-item-check");
      if (checkbox) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event("change"));
      }

      const conferencia = conferencias.find((registro) => normalizarChaveItem(registro) === normalizarChaveItem(item))
        || conferencias.find((registro) =>
          safeText(registro.codigo_item || registro.codigo || "") === safeText(item.codigo_pai || item.codigo_item || item.codigo || "")
          && safeText(registro.item_campo || registro.campo || "") === safeText(item.item_campo || item.campo || "")
        );

      if (conferencia) {
        setCardRefugoState(card, {
          quantidade: Number(conferencia.quantidade_nc || 0),
          codigoNc: conferencia.codigo_nc || "",
          observacao: conferencia.observacao || "",
        });
      }
    });

    updateSelectedCount();
  }

  async function carregarDadosOp() {
    try {
      setStatus("Carregando dados da OP...", "");
      const dados = await fetchJson(`/api/qualidade/inspecoes/op/${op}`);

      const codigoPai = Number(dados.codigo || 0);
      const descricao = safeText(dados.descricao || "");
      const quantidade = Number(dados.quantidade || 0);

      linhaInspecao = safeText(dados.linha || "");
      if (opTitle) opTitle.textContent = linhaInspecao || "OP não encontrada";
      if (lineChip) lineChip.textContent = linhaInspecao || "Linha não informada";
      if (opHighlight) opHighlight.textContent = safeText(dados.op || op);
      if (codeHighlight) codeHighlight.textContent = String(codigoPai || "-");
      if (qtyHighlight) qtyHighlight.textContent = String(quantidade || "-");
      if (visualDescricao) visualDescricao.textContent = safeText(dados.descricao || "");

      if (fields.op) fields.op.value = safeText(dados.op || op);
      if (fields.codigo) fields.codigo.value = String(codigoPai || "");
      if (fields.descricao) fields.descricao.value = descricao;
      if (fields.quantidade) fields.quantidade.value = String(quantidade || "");
      if (fields.inicio) fields.inicio.value = nowForInput();
      if (fields.fim) fields.fim.value = "";
      if (fields.observacao) fields.observacao.value = safeText(dados.observacao || "");
      if (fields.destino) setSelectValue(fields.destino, normalizeDestinoValue(dados.destino || ""));
      if (fields.status) setSelectValue(fields.status, normalizeStatusValue(dados.status || dados.status_qualidade || "Iniciado"));
      if (fields.resultado) setSelectValue(fields.resultado, dados.resultado === "Reprovado" ? "false" : "true");

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

      const ultimaInspecaoApi = dados.inspecao_ultima && dados.inspecao_ultima.id_inspecao ? dados.inspecao_ultima : null;
      let reinspecaoCarregada = !idInspecaoReinspecao;
      let mensagemReinspecao = "";

      if (idInspecaoReinspecao) {
        try {
          const reinspecao = await fetchJson(`/api/qualidade/inspecoes/dados/${encodeURIComponent(idInspecaoReinspecao)}`);
          aplicarReinspecao(reinspecao);
          reinspecaoCarregada = true;
          mensagemReinspecao = "Reinspeção carregada com sucesso.";
        } catch (error) {
          console.error(error);
          if (ultimaInspecaoApi) {
            aplicarReinspecao(ultimaInspecaoApi);
            reinspecaoCarregada = true;
            mensagemReinspecao = "A reinspeção solicitada não foi encontrada. Último estado da OP carregado.";
          } else {
            reinspecaoCarregada = false;
            mensagemReinspecao = "A OP foi carregada, mas os dados da reinspeção não puderam ser recuperados.";
          }
        }
      } else if (ultimaInspecaoApi) {
        aplicarReinspecao(ultimaInspecaoApi);
        reinspecaoCarregada = true;
        mensagemReinspecao = "Último estado da OP carregado.";
      } else {
        if (fields.status) {
          setSelectValue(fields.status, "Iniciado");
        }
      }

      updateSelectedCount();
      if (reinspecaoCarregada && mensagemReinspecao) {
        setStatus(mensagemReinspecao, idInspecaoReinspecao && !mensagemReinspecao.startsWith("Reinspeção") ? "error" : "success");
      } else if (reinspecaoCarregada && !idInspecaoReinspecao && !ultimaInspecaoApi) {
        setStatus("Dados da OP carregados.", "success");
      }
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

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const destino = normalizeDestinoValue(fields.destino?.value || "");
    const statusSelecionado = normalizeStatusValue(fields.status?.value || "");

    if (!destino) {
      setStatus("Selecione o destino do produto antes de salvar.", "error");
      return;
    }

    if (!statusSelecionado || normalizeText(statusSelecionado) === "iniciado") {
      setStatus("Selecione um status diferente de Iniciado antes de salvar.", "error");
      return;
    }

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
      qtd_etiquetas: itens.length || 1,
      status: statusSelecionado,
      conformidade: !!fields.conformidade?.checked,
      refugo: !!refugoToggle?.checked,
      aprovado: fields.resultado?.value === "true",
      resultado: fields.resultado?.value === "true" ? "Aprovado" : "Reprovado",
      tipo_inspecao: "op",
      observacao: fields.observacao?.value || "",
      itens_inspecionados: itens,
      refugos: refugoToggle?.checked ? refugos : [],
      codigo_nc: refugos[0]?.codigo_nc || "",
      destino,
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

  carregarDadosOp();
});
