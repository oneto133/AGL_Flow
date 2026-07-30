(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const esc = value => String(value ?? "-").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const fmt = n => new Intl.NumberFormat("pt-BR").format(Number(n || 0));
  const state = { detail: null };

  function card(item) {
    const pct = item.quantidade_programada ? Math.min(100, item.quantidade_produzida / item.quantidade_programada * 100) : 0;
    const el = document.importNode($("#painelCardTemplate").content, true).firstElementChild;
    el.dataset.state = pct >= 90 ? "good" : pct >= 50 ? "warn" : "danger";
    el.dataset.linha = item.linha;
    $("[data-field=programada]", el).textContent = fmt(item.quantidade_programada);
    $("[data-field=ultimoApontamento]", el).textContent = fmt(item.quantidade_produzida);
    $("[data-field=previsaoSaida]", el).textContent = item.previsao_saida;
    $("[data-field=eficiencia]", el).textContent = `${Math.round(pct)}%`;
    $("[data-field=inicioFila]", el).textContent = item.inicio_producao;
    $("[data-field=sequenciamento]", el).textContent = item.data_sequenciamento || "-";
    $("[data-field=posicao]", el).textContent = item.posicao ? `Posição ${item.posicao}` : "-";
    $("[data-field=esperadoQtd]", el).textContent = fmt(item.quantidade_programada);
    $("[data-field=apontadoQtd]", el).textContent = fmt(item.quantidade_produzida);
    $("[data-field=esperadoBar]", el).style.width = "100%";
    $("[data-field=apontadoBar]", el).style.width = `${pct}%`;
    $(".painel-card__title", el).textContent = item.linha;
    $(".painel-card__subtitle", el).textContent = `OP ${item.op} · ${item.codigo} · ${item.descricao}`;
    $(".painel-badge", el).textContent = item.status || "Em fila";
    el.addEventListener("click", () => abrir(item.linha));
    return el;
  }

  async function carregar() {
    const status = $("#painelStatus"); status.textContent = "Atualizando painel…"; status.classList.remove("painel-status--erro");
    try {
      const dados = await fetch("/api/painel-producao").then(r => r.ok ? r.json() : Promise.reject(r));
      $("#painelTotalSecoes").textContent = dados.totais.secoes; $("#painelTotalCards").textContent = dados.totais.linhas; $("#painelTotalOps").textContent = dados.totais.ops;
      const root = $("#painelSecoes"); root.innerHTML = "";
      if (!dados.secoes.length) { root.innerHTML = '<div class="painel-vazio">Nenhuma linha com OP sequenciada no momento.</div>'; }
      dados.secoes.forEach(secao => { const box = document.createElement("section"); box.className = "painel-secao"; box.innerHTML = `<header class="painel-secao__header"><div><h2>${esc(secao.titulo)}</h2><p>${secao.linhas.length} linha(s) ativa(s)</p></div><span class="painel-secao__count">${secao.linhas.length} cartões</span></header><div class="painel-secao__body"><div class="painel-grid"></div></div>`; const grid = $(".painel-grid", box); secao.linhas.forEach(item => grid.appendChild(card(item))); root.appendChild(box); });
      status.textContent = `Atualizado às ${new Date().toLocaleTimeString("pt-BR", {hour:"2-digit", minute:"2-digit"})}`;
    } catch (e) { status.textContent = "Não foi possível carregar o painel."; status.classList.add("painel-status--erro"); }
  }

  function tabela(rows, tipo) {
    if (!rows.length) return '<div class="painel-vazio">Nenhum registro encontrado.</div>';
    const cols = tipo === "ordens" ? ["OP", "Código", "Descrição", "Quantidade", "Último apontamento", "Previsão"] : ["OP", "Código", "Quantidade", "Data/hora", "Status"];
    return `<div class="painel-table-wrap"><table class="painel-table"><thead><tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.map(r => tipo === "ordens" ? `<tr><td>${esc(r.op)}</td><td>${esc(r.codigo)}</td><td>${esc(r.descricao)}</td><td>${fmt(r.quantidade_programada)}</td><td>${fmt(r.quantidade_produzida)}</td><td>${esc(r.previsao_saida)}</td></tr>` : `<tr><td>${esc(r.op)}</td><td>${esc(r.codigo)}</td><td>${fmt(r.quantidade)}</td><td>${esc(r.data_hora)}</td><td>${esc(r.status)}</td></tr>`).join("")}</tbody></table></div>`;
  }
  async function abrir(linha) { const modal = $("#painelModal"); modal.classList.add("is-open"); modal.setAttribute("aria-hidden", "false"); $("#modalLinhaTitulo").textContent = linha; $("#modalLinhaSubtitulo").textContent = "Carregando dados…"; try { state.detail = await fetch(`/api/painel-producao/linha/${encodeURIComponent(linha)}`).then(r => r.json()); const d = state.detail; $("#modalLinhaSubtitulo").textContent = `${d.secao} · capacidade: ${d.capacidade.minutos_por_unidade} min/un · confiança: ${d.capacidade.confianca}`; const atual = d.ordens[0] || {}; $("#modalVisao").innerHTML = `<div class="modal-kpis"><div><span>OP atual</span><strong>${esc(atual.op || "-")}</strong></div><div><span>Programada</span><strong>${fmt(atual.quantidade_programada)}</strong></div><div><span>Produzida</span><strong>${fmt(atual.quantidade_produzida)}</strong></div><div><span>Status</span><strong>${esc(atual.status || "-")}</strong></div></div><div class="modal-overview"><div class="donut" style="--progress:${atual.quantidade_programada ? Math.min(100, atual.quantidade_produzida / atual.quantidade_programada * 100) : 0}%"><span>${atual.quantidade_programada ? Math.round(atual.quantidade_produzida / atual.quantidade_programada * 100) : 0}%</span></div><div><p><b>Início da produção:</b> ${esc(atual.inicio_producao)}</p><p><b>Previsão de saída:</b> ${esc(atual.previsao_saida)}</p><p><b>Último apontamento:</b> ${esc(atual.ultimo_apontamento)}</p></div></div>`; $("#modalOrdens").innerHTML = tabela(d.ordens, "ordens"); $("#modalApontamentos").innerHTML = tabela(d.apontamentos, "apontamentos"); } catch { $("#modalVisao").textContent = "Não foi possível carregar os detalhes."; } }
  function fechar() { $("#painelModal").classList.remove("is-open"); $("#painelModal").setAttribute("aria-hidden", "true"); }
  document.addEventListener("click", e => { if (e.target.matches("[data-close-modal]")) fechar(); if (e.target.matches(".painel-tab")) { document.querySelectorAll(".painel-tab, .painel-tab-content").forEach(x => x.classList.remove("is-active")); e.target.classList.add("is-active"); $("#modal" + e.target.dataset.tab.charAt(0).toUpperCase() + e.target.dataset.tab.slice(1)).classList.add("is-active"); } });
  function tabela(rows, tipo) {
    if (!rows.length) return '<div class="painel-vazio">Nenhum registro encontrado.</div>';
    const ordens = tipo === "ordens";
    const cols = ordens ? ["OP", "Código", "Descrição", "Quantidade", "Data/hora sequência", "Início fila", "Previsão saída", "Status"] : ["OP", "Código", "Quantidade", "Data/hora", "Status", "Observação"];
    const body = rows.map(r => ordens ? `<tr><td>${esc(r.op)}</td><td>${esc(r.codigo)}</td><td>${esc(r.descricao)}</td><td>${fmt(r.quantidade_programada)}</td><td>${esc(r.data_sequenciamento)}</td><td>${esc(r.hora_inicio_fila || "-")}</td><td>${esc(r.previsao_saida)}</td><td>${esc(r.status)}</td></tr>` : `<tr><td>${esc(r.op)}</td><td>${esc(r.codigo)}</td><td>${fmt(r.quantidade)}</td><td>${esc(r.data_hora)}</td><td>${esc(r.status)}</td><td>${esc(r.observacao || "-")}</td></tr>`).join("");
    return `<div class="painel-table-wrap"><table class="painel-table"><thead><tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
  }
  $("#btnAtualizarPainel").addEventListener("click", carregar); carregar(); setInterval(carregar, 60000);
  const sidebar = $("#painelSidebar");
  const secaoFiltro = $("#eficienciaSecao");
  const linhaFiltro = $("#eficienciaLinha");
  const abrirConfig = () => { sidebar.classList.add("is-open"); sidebar.setAttribute("aria-hidden", "false"); };
  const fecharConfig = () => { sidebar.classList.remove("is-open"); sidebar.setAttribute("aria-hidden", "true"); };
  $("#btnPainelConfig").addEventListener("click", abrirConfig); $("#btnFecharConfig").addEventListener("click", fecharConfig);
  function montarFiltros() {
    fetch("/api/qualidade/inspecoes/secoes").then(r => r.json()).then(secoes => { secaoFiltro.innerHTML = '<option value="">Todas as seções</option>'; secoes.forEach(s => { const op = document.createElement("option"); op.value = s.secao; op.textContent = s.titulo; secaoFiltro.appendChild(op); }); atualizarLinhas(secoes); });
  }
  function atualizarLinhas(secoes) { const item = secoes.find(s => s.secao === secaoFiltro.value); linhaFiltro.innerHTML = '<option value="">Todas as linhas</option>'; (item ? item.linhas : secoes.flatMap(s => s.linhas || [])).forEach(l => { const op = document.createElement("option"); op.value = l.celula_linha; op.textContent = l.celula_linha; linhaFiltro.appendChild(op); }); }
  secaoFiltro.addEventListener("change", () => fetch("/api/qualidade/inspecoes/secoes").then(r => r.json()).then(atualizarLinhas));
  function desenharGrafico(dados) { const canvas = $("#eficienciaChart"), ctx = canvas.getContext("2d"), w = canvas.width = canvas.clientWidth * devicePixelRatio, h = canvas.height = 330 * devicePixelRatio; ctx.scale(devicePixelRatio, devicePixelRatio); const largura = canvas.clientWidth, altura = 330; ctx.clearRect(0, 0, largura, altura); const pontos = dados.pontos || []; const max = Math.max(1, ...pontos.flatMap(p => [p.programado, p.produzido])); ctx.strokeStyle = "rgba(255,255,255,.15)"; ctx.beginPath(); ctx.moveTo(42, 20); ctx.lineTo(42, altura - 35); ctx.lineTo(largura - 15, altura - 35); ctx.stroke(); const x = i => pontos.length < 2 ? largura / 2 : 48 + i * ((largura - 68) / (pontos.length - 1)); const y = n => altura - 38 - (n / max) * (altura - 70); const series = [["programado", "#a8d8f0"], ["produzido", "#1fba74"]]; if ($("#eficienciaTipo").value === "bar") { const gap = (largura - 75) / Math.max(1, pontos.length); pontos.forEach((p,i) => series.forEach((s,j) => { const bh = (p[s[0]] / max) * (altura - 70); ctx.fillStyle = s[1]; ctx.fillRect(48 + i * gap + j * gap / 2, altura - 38 - bh, gap / 2 - 3, bh); })); } else { series.forEach(s => { ctx.strokeStyle = s[1]; ctx.lineWidth = 3; ctx.beginPath(); pontos.forEach((p,i) => i ? ctx.lineTo(x(i), y(p[s[0]])) : ctx.moveTo(x(i), y(p[s[0]]))); ctx.stroke(); }); } ctx.fillStyle = "#dce8f2"; ctx.font = "11px sans-serif"; pontos.forEach((p,i) => ctx.fillText(p.data || p.op, x(i)-18, altura-15)); }
  async function carregarEficiencia() { const params = new URLSearchParams({secao:secaoFiltro.value, linha:linhaFiltro.value, periodo:$("#eficienciaPeriodo").value}); const dados = await fetch(`/api/painel-producao/eficiencia?${params}`).then(r => r.json()); desenharGrafico(dados); $("#eficienciaIndicador").innerHTML = `<strong>${dados.totais.eficiencia}%</strong><span>eficiência · ${fmt(dados.totais.produzido)} produzidos de ${fmt(dados.totais.programado)} programados</span>`; $("#eficienciaResumo").innerHTML = (dados.resumo || []).map(r => `<div><b>${esc(r.linha)}</b><span>${fmt(r.produzido)} / ${fmt(r.programado)} · ${r.eficiencia}%</span></div>`).join("") || '<div class="painel-vazio">Nenhum histórico para os filtros.</div>'; }
  $("#btnAtualizarEficiencia").addEventListener("click", carregarEficiencia); $("#eficienciaTipo").addEventListener("change", carregarEficiencia); $("#btnImprimirEficiencia").addEventListener("click", () => window.print()); montarFiltros();
  document.addEventListener("click", event => { if (event.target.id === "btnImprimirEficiencia") { $("#eficienciaPrintTitle").textContent = `Eficiência de produção · ${linhaFiltro.value || secaoFiltro.value || "geral"}`; } });
})();
