(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = (value) => String(value ?? "-").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
  const fmt = (value) => new Intl.NumberFormat("pt-BR").format(Number(value || 0));
  const normalizarStatus = (value) => String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  const loading = $("#painelLoading");
  const indicador = $("#painelIndicadorRotativo");
  let loadingTimer = null;
  let carregamentoInicial = true;
  let indicadorTimer = null;
  let indicadorIndice = 0;

  function atualizarIndicador(secoes) {
    if (!indicador) return;
    window.clearInterval(indicadorTimer);
    const linhas = secoes.flatMap((secao) => secao.linhas.map((item) => ({ ...item, secao: secao.titulo })));
    const slides = secoes.map((secao) => ({
      titulo: `Produção · ${secao.titulo}`,
      valor: `${fmt(secao.linhas.reduce((total, item) => total + Number(item.quantidade_apontada || 0), 0))} un`,
      detalhe: "Total apontado na seção",
    }));
    const operadores = new Map();
    linhas.forEach((item) => {
      const operador = item.operador || "Não informado";
      const atual = operadores.get(operador) || { quantidade: 0, observacoes: [] };
      atual.quantidade += Number(item.quantidade_apontada || 0);
      if (item.ultima_observacao) atual.observacoes.push(item.ultima_observacao);
      operadores.set(operador, atual);
    });
    operadores.forEach((item, operador) => slides.push({
      titulo: `Operador · ${operador}`,
      valor: `${fmt(item.quantidade)} un`,
      detalhe: item.observacoes[0] || "Total produzido nas linhas ativas",
    }));
    const desempenhoSecoes = secoes.map((secao) => ({
      secao,
      desempenho: secao.linhas.reduce((total, item) => total + Number(item.diferenca_eficiencia || 0), 0),
    })).sort((a, b) => b.desempenho - a.desempenho);
    const destaque = desempenhoSecoes[0];
    if (destaque) {
      slides.push({
        titulo: `Maior desempenho · ${destaque.secao.titulo}`,
        valor: `${destaque.desempenho > 0 ? "+" : ""}${fmt(destaque.desempenho)} un`,
        detalhe: "Variação acumulada da seção",
      });
      destaque.secao.linhas
        .slice()
        .sort((a, b) => Number(b.diferenca_eficiencia || 0) - Number(a.diferenca_eficiencia || 0))
        .forEach((item) => slides.push({
          titulo: `${item.linha} · ${destaque.secao.titulo}`,
          valor: `${fmt(item.quantidade_apontada || 0)} un`,
          detalhe: item.ultima_observacao || "Linha com maior desempenho da seção",
        }));
    }
    if (!slides.length) slides.push({ titulo: "Indicadores de produção", valor: "Sem dados", detalhe: "Nenhuma linha ativa" });
    const exibir = () => {
      const slide = slides[indicadorIndice % slides.length];
      $("[data-indicador-titulo]", indicador).textContent = slide.titulo;
      $("[data-indicador-valor]", indicador).textContent = slide.valor;
      $("[data-indicador-detalhe]", indicador).textContent = slide.detalhe;
      indicador.classList.remove("is-changing");
      void indicador.offsetWidth;
      indicador.classList.add("is-changing");
      indicadorIndice = (indicadorIndice + 1) % slides.length;
    };
    exibir();
    indicadorTimer = window.setInterval(exibir, 5000);
  }

  function iniciarCarregamento() {
    if (!loading) return;
    window.clearTimeout(loadingTimer);
    loadingTimer = window.setTimeout(() => {
      loading.classList.remove("is-hidden");
    }, 350);
  }

  function finalizarCarregamento() {
    window.clearTimeout(loadingTimer);
    loading?.classList.add("is-hidden");
  }

  function criarCard(item) {
    const el = document.importNode($("#painelCardTemplate").content, true).firstElementChild;
    const disponivel = item.metricas_disponiveis === true;
    const esperado = Number(item.quantidade_deveria_produzida || 0);
    const apontadoOp = Number(item.quantidade_apontada ?? item.quantidade_produzida ?? 0);
    const apontado = Number(item.quantidade_apontada_dia ?? 0);
    const diferenca = Number(item.diferenca_eficiencia || 0);
    const desempenho = esperado > 0 ? apontado / esperado * 100 : 0;
    const programada = Number(item.quantidade_programada || 0);
    const progressoTotal = programada ? Math.min(100, apontadoOp / programada * 100) : 0;
    const progressoEsperado = programada ? Math.min(100, esperado / programada * 100) : 0;
    const progressoDesempenho = esperado ? Math.min(100, apontado / esperado * 100) : 0;

    el.dataset.state = !disponivel
      ? "neutral"
      : diferenca >= 0
        ? "good"
        : diferenca >= -Math.max(1, esperado * 0.1)
          ? "warn"
          : "danger";
    el.dataset.linha = item.linha;

    $("[data-field=programada]", el).textContent = fmt(programada);
    $("[data-field=ultimoApontamento]", el).textContent = fmt(apontadoOp);
    $("[data-field=previsaoSaida]", el).textContent = item.previsao_saida;
    $("[data-field=eficiencia]", el).textContent = disponivel
      ? `${fmt(desempenho)}%`
      : "Dados insuficientes";
    $("[data-field=inicioFila]", el).textContent = item.hora_inicio_fila || "-";
    $("[data-field=sequenciamento]", el).textContent = item.data_sequenciamento || "-";
    $("[data-field=ultimoApontamentoData]", el).textContent = item.ultimo_apontamento || "-";
    $("[data-field=esperadoQtd]", el).textContent = disponivel ? fmt(esperado) : "-";
    $("[data-field=apontadoQtd]", el).textContent = fmt(apontado);
    $("[data-field=esperadoBar]", el).style.width = disponivel ? `${progressoEsperado}%` : "0%";
    $("[data-field=apontadoBar]", el).style.width = disponivel ? `${progressoDesempenho}%` : `${progressoTotal}%`;
    $(".painel-card__title", el).textContent = item.linha;
    $(".painel-card__subtitle", el).textContent = `OP ${item.op} · ${item.codigo} · ${item.descricao}`;
    const badge = $(".painel-badge", el);
    const status = item.status || "Em fila";
    const statusNormalizado = normalizarStatus(status);
    badge.textContent = status;
    badge.classList.toggle("painel-badge--em-processo", statusNormalizado === "em processo");
    badge.classList.toggle("painel-badge--pausado", statusNormalizado === "pausado");

    const aviso = $("[data-field=metricasAviso]", el);
    if (aviso) {
      aviso.hidden = disponivel;
      aviso.textContent = disponivel
        ? ""
        : item.metricas_mensagem || "Dados insuficientes para gerar métricas.";
    }

    el.addEventListener("click", () => abrirModal(item.linha));
    return el;
  }

  async function carregar() {
    const status = $("#painelStatus");
    const exibirCarregamento = carregamentoInicial;
    carregamentoInicial = false;
    if (exibirCarregamento) iniciarCarregamento();
    status.textContent = "Atualizando painel...";
    status.classList.remove("painel-status--erro");

    try {
      const dados = await fetch("/api/painel-producao").then((response) => response.json());
      $("#painelTotalSecoes").textContent = dados.totais.secoes;
      $("#painelTotalCards").textContent = dados.totais.linhas;
      $("#painelTotalOps").textContent = dados.totais.ops;
      atualizarIndicador(dados.secoes);

      const root = $("#painelSecoes");
      root.innerHTML = "";
      if (!dados.secoes.length) {
        root.innerHTML = '<div class="painel-vazio">Nenhuma linha com OP sequenciada no momento.</div>';
      }

      dados.secoes.forEach((secao) => {
        const box = document.createElement("section");
        box.className = "painel-secao";
        box.innerHTML = `<header class="painel-secao__header"><h2>${esc(secao.titulo)}</h2><p>${secao.linhas.length} linha(s) ativa(s)</p><span class="painel-secao__count">${secao.linhas.length} cartoes</span></header><div class="painel-secao__body"><div class="painel-grid"></div></div>`;
        const grid = $(".painel-grid", box);
        secao.linhas.forEach((item) => grid.appendChild(criarCard(item)));
        root.appendChild(box);
      });

      status.textContent = `Atualizado às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}hs`;
    } catch (error) {
      status.textContent = "Nao foi possivel carregar o painel.";
      status.classList.add("painel-status--erro");
    } finally {
      if (exibirCarregamento) finalizarCarregamento();
    }
  }

  function tabela(rows, tipo, secao = "", linha = "") {
    if (!rows.length) return '<div class="painel-vazio">Nenhum registro encontrado.</div>';
    const ordens = tipo === "ordens";
    const permiteImpressao = ordens && normalizarStatus(secao) === "basculante";
    const cols = ordens
      ? ["OP", "Codigo", "Descricao", "Quantidade", "Data/hora sequencia", "Inicio fila", "Previsao saida", "Status", ...(permiteImpressao ? ["Imprimir"] : [])]
      : ["OP", "Codigo", "Quantidade", "Data/hora", "Status", "Observacao"];
    const body = rows.map((row) => ordens
      ? `<tr><td>${esc(row.op)}</td><td>${esc(row.codigo)}</td><td>${esc(row.descricao)}</td><td>${fmt(row.quantidade_programada)}</td><td>${esc(row.data_sequenciamento)}</td><td>${esc(row.hora_inicio_fila || "-")}</td><td>${esc(row.previsao_saida)}</td><td>${esc(row.status)}</td>${permiteImpressao ? `<td><button type="button" class="painel-imprimir-ordem" data-op="${esc(row.op)}" data-codigo="${esc(row.codigo)}" data-linha="${esc(row.linha || linha)}" title="Imprimir ordem" aria-label="Imprimir ordem">🖨</button></td>` : ""}</tr>`
      : `<tr><td>${esc(row.op)}</td><td>${esc(row.codigo)}</td><td>${fmt(row.quantidade)}</td><td>${esc(row.data_hora)}</td><td>${esc(row.status)}</td><td>${esc(row.observacao || "-")}</td></tr>`
    ).join("");
    return `<div class="painel-table-wrap"><table class="painel-table"><thead><tr>${cols.map((col) => `<th>${col}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function desenharGraficoApontamentos(canvas, tooltip, pontos, tipo, mostrarMediaMovel) {
    const ctx = canvas.getContext("2d");
    const cssW = canvas.clientWidth || 760;
    const cssH = 300;
    const ratio = window.devicePixelRatio || 1;
    const margemEsquerda = 48;
    const margemDireita = 18;
    const margemTopo = 18;
    const margemBase = 42;
    const larguraUtil = cssW - margemEsquerda - margemDireita;
    const alturaUtil = cssH - margemTopo - margemBase;
    const maximo = Math.max(1, ...pontos.map((ponto) => Number(ponto.quantidade || 0)));

    canvas.width = cssW * ratio;
    canvas.height = cssH * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.font = "11px sans-serif";
    ctx.strokeStyle = "rgba(255,255,255,.16)";
    ctx.fillStyle = "rgba(235,241,248,.68)";
    ctx.beginPath();
    ctx.moveTo(margemEsquerda, margemTopo);
    ctx.lineTo(margemEsquerda, cssH - margemBase);
    ctx.lineTo(cssW - margemDireita, cssH - margemBase);
    ctx.stroke();

    if (!pontos.length) {
      ctx.fillText("Nenhum apontamento encontrado", margemEsquerda, cssH / 2);
      return;
    }

    const x = (index) => pontos.length === 1
      ? margemEsquerda + larguraUtil / 2
      : margemEsquerda + index * larguraUtil / (pontos.length - 1);
    const y = (quantidade) => cssH - margemBase - Number(quantidade || 0) / maximo * alturaUtil;

    ctx.fillStyle = "rgba(168,216,240,.78)";
    pontos.forEach((ponto, index) => {
      const posicaoX = tipo === "bar"
        ? margemEsquerda + index * larguraUtil / Math.max(1, pontos.length)
        : x(index);
      const larguraBarra = Math.max(12, larguraUtil / Math.max(1, pontos.length) * 0.62);
      const alturaBarra = cssH - margemBase - y(ponto.quantidade);
      if (tipo === "bar") {
        ctx.fillRect(posicaoX + (larguraUtil / Math.max(1, pontos.length) - larguraBarra) / 2, y(ponto.quantidade), larguraBarra, alturaBarra);
      }
      ctx.fillStyle = "rgba(235,241,248,.72)";
      ctx.textAlign = "center";
      ctx.fillText(ponto.hora, posicaoX + (tipo === "bar" ? larguraUtil / Math.max(1, pontos.length) / 2 : 0), cssH - 16);
      ctx.fillStyle = "rgba(168,216,240,.78)";
    });

    if (tipo === "line") {
      ctx.strokeStyle = "#a8d8f0";
      ctx.lineWidth = 3;
      ctx.beginPath();
      pontos.forEach((ponto, index) => index ? ctx.lineTo(x(index), y(ponto.quantidade)) : ctx.moveTo(x(index), y(ponto.quantidade)));
      ctx.stroke();
      ctx.fillStyle = "#a8d8f0";
      pontos.forEach((ponto, index) => {
        ctx.beginPath();
        ctx.arc(x(index), y(ponto.quantidade), 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    if (mostrarMediaMovel && pontos.length) {
      const janela = 3;
      const medias = pontos.map((_, index) => {
        const inicio = Math.max(0, index - janela + 1);
        const amostra = pontos.slice(inicio, index + 1);
        return amostra.reduce((total, ponto) => total + Number(ponto.quantidade || 0), 0) / amostra.length;
      });
      ctx.strokeStyle = "#f1c232";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      medias.forEach((media, index) => index ? ctx.lineTo(x(index), y(media)) : ctx.moveTo(x(index), y(media)));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const mostrarTooltip = (event) => {
      const rect = canvas.getBoundingClientRect();
      const posicao = Math.max(0, Math.min(cssW, event.clientX - rect.left));
      const indice = tipo === "bar"
        ? Math.round((posicao - margemEsquerda) / (larguraUtil / Math.max(1, pontos.length)) - 0.5)
        : Math.round((posicao - margemEsquerda) / (larguraUtil / Math.max(1, pontos.length - 1)));
      const ponto = pontos[Math.max(0, Math.min(pontos.length - 1, indice))];
      if (!ponto) return;
      tooltip.textContent = `${ponto.hora} · ${fmt(ponto.quantidade)} apontadas${ponto.observacao ? ` · Observação: ${ponto.observacao}` : ""}`;
      tooltip.hidden = false;
      tooltip.style.left = `${Math.min(rect.width - 190, Math.max(8, event.clientX - rect.left + 12))}px`;
      tooltip.style.top = `${Math.max(8, event.clientY - rect.top - 38)}px`;
    };

    canvas.onmousemove = mostrarTooltip;
    canvas.onmouseleave = () => { tooltip.hidden = true; };
  }

  function montarGraficoApontamentos(dados) {
    const resumo = dados.resumo_producao || {};
    const wrapper = document.createElement("section");
    wrapper.className = "painel-grafico-apontamentos";
    wrapper.innerHTML = `<header class="painel-grafico-apontamentos__header"><div><p class="eyebrow">PRODUÇÃO POR HORA</p><h3>Apontamentos da linha</h3></div><div class="painel-grafico-apontamentos__actions"><select aria-label="Tipo do grafico"><option value="bar">Barras</option><option value="line">Linhas</option></select><select aria-label="Periodo do grafico" data-periodo-grafico><option value="dia">Dia atual</option><option value="semana">Semana</option></select><button type="button" class="secondary-button">Imprimir</button></div></header><div class="painel-grafico-apontamentos__canvas"><canvas height="300"></canvas><div class="painel-grafico-tooltip" hidden></div></div><div class="painel-grafico-apontamentos__kpis"><div><span>Deveria ter produzido (OP atual)</span><strong>${resumo.metricas_disponiveis ? fmt(Math.min(Number(resumo.quantidade_deveria_produzida || 0), Number(resumo.quantidade_programada || 0))) : "Dados insuficientes"}</strong></div><div><span>Apontado (OP atual)</span><strong data-kpi-apontado>${fmt(resumo.quantidade_apontada)}</strong></div><div><span>Média por hora (linha)</span><strong data-kpi-media>${fmt(resumo.media_por_hora)} un/h</strong></div></div>`;
    const actions = $(".painel-grafico-apontamentos__actions", wrapper);
    const mediaMovel = document.createElement("label");
    mediaMovel.className = "painel-grafico-media-movel";
    mediaMovel.innerHTML = '<input type="checkbox" checked aria-label="Exibir média móvel"> Média móvel';
    actions.insertBefore(mediaMovel, $("button", actions));
    const canvas = $("canvas", wrapper);
    const tooltip = $(".painel-grafico-tooltip", wrapper);
    const tipo = $("select", wrapper);
    const periodo = $("[data-periodo-grafico]", wrapper);
    let pontos = dados.apontamentos_hora || [];
    const desenhar = () => desenharGraficoApontamentos(canvas, tooltip, pontos, tipo.value, $("input", mediaMovel).checked);
    tipo.addEventListener("change", desenhar);
    $("input", mediaMovel).addEventListener("change", desenhar);
    periodo.addEventListener("change", async () => {
      const atualizado = await fetch(`/api/painel-producao/linha/${encodeURIComponent(dados.linha)}?periodo=${periodo.value}`).then((response) => response.json());
      pontos = atualizado.apontamentos_hora || [];
      $("[data-kpi-apontado]", wrapper).textContent = fmt(atualizado.resumo_producao?.quantidade_apontada);
      $("[data-kpi-media]", wrapper).textContent = `${fmt(atualizado.resumo_producao?.media_por_hora)} un/h`;
      desenhar();
    });
    $("button", wrapper).addEventListener("click", () => {
      document.body.classList.add("imprimir-painel-grafico");
      window.print();
      setTimeout(() => document.body.classList.remove("imprimir-painel-grafico"), 500);
    });
    requestAnimationFrame(desenhar);
    return wrapper;
  }

  async function abrirModal(linha) {
    const modal = $("#painelModal");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    $("#modalLinhaTitulo").textContent = linha;

    try {
      const dados = await fetch(`/api/painel-producao/linha/${encodeURIComponent(linha)}`).then((response) => response.json());
      const atual = dados.ordens[0] || {};
      const desempenhoAtual = Number(atual.quantidade_deveria_produzida || 0) > 0 ? Number(atual.quantidade_apontada_dia || 0) / Number(atual.quantidade_deveria_produzida) * 100 : 0;
      $("#modalLinhaSubtitulo").textContent = `${atual.codigo || "-"} · ${atual.descricao || "-"} · ${dados.secao.toUpperCase()} · Confiança: ${dados.capacidade.confianca.toUpperCase()}`;
      $("#modalVisao").innerHTML = `<div class="modal-kpis"><div><span>OP atual</span><strong>${esc(atual.op || "-")}</strong></div><div><span>Programada</span><strong>${fmt(atual.quantidade_programada)}</strong></div><div><span>Apontado no dia</span><strong>${fmt(atual.quantidade_apontada_dia || 0)}</strong></div><div><span>Desempenho</span><strong>${atual.metricas_disponiveis ? `${fmt(desempenhoAtual)}%` : "Dados insuficientes"}</strong></div></div><div class="modal-overview"><div><p><b>Inicio da fila:</b> ${esc(atual.hora_inicio_fila || "-")}</p><p><b>Previsao de saida:</b> ${esc(atual.previsao_saida)}</p><p><b>Ultimo apontamento:</b> ${esc(atual.ultimo_apontamento)}</p><p><b>Metricas:</b> ${esc(atual.metricas_mensagem || "-")}</p></div></div>`;
      $("#modalVisao").appendChild(montarGraficoApontamentos(dados));
      $("#modalOrdens").innerHTML = tabela(dados.ordens, "ordens", dados.secao, dados.linha);
      $("#modalApontamentos").innerHTML = tabela(dados.apontamentos, "apontamentos");
    } catch (error) {
      $("#modalVisao").textContent = "Nao foi possivel carregar os detalhes.";
    }
  }

  const fechar = () => {
    $("#painelModal").classList.remove("is-open");
    $("#painelModal").setAttribute("aria-hidden", "true");
  };

  document.addEventListener("click", (event) => {
    const imprimirOrdem = event.target.closest(".painel-imprimir-ordem");
    if (imprimirOrdem) {
      const params = new URLSearchParams({
        op: imprimirOrdem.dataset.op || "",
        codigo: imprimirOrdem.dataset.codigo || "",
        linha: imprimirOrdem.dataset.linha || "",
      });
      window.open(`/painel-producao/impressao/basculante?${params.toString()}`, "_blank", "noopener");
      return;
    }
    if (event.target.matches("[data-close-modal]")) fechar();
    if (event.target.matches(".painel-tab")) {
      document.querySelectorAll(".painel-tab, .painel-tab-content").forEach((element) => element.classList.remove("is-active"));
      event.target.classList.add("is-active");
      $("#modal" + event.target.dataset.tab[0].toUpperCase() + event.target.dataset.tab.slice(1)).classList.add("is-active");
    }
  });

  $("#btnAtualizarPainel").addEventListener("click", carregar);
  $("#btnPainelConfig").addEventListener("click", () => $("#painelSidebar").classList.add("is-open"));
  $("#btnFecharConfig").addEventListener("click", () => $("#painelSidebar").classList.remove("is-open"));
  carregar();
  setInterval(carregar, 60000);

  const painelSidebar = $("#painelSidebar");
  $("#btnFecharConfig").addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    painelSidebar.classList.remove("is-open");
    painelSidebar.setAttribute("aria-hidden", "true");
  });
  painelSidebar.addEventListener("click", (event) => {
    if (event.target === painelSidebar) {
      painelSidebar.classList.remove("is-open");
      painelSidebar.setAttribute("aria-hidden", "true");
    }
  });
})();
