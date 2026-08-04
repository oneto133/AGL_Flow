(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = (value) => String(value ?? "-").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[char]));
  const fmt = (value) => new Intl.NumberFormat("pt-BR").format(Number(value || 0));
  const palco = $("#exibicaoPalco");
  const progress = $("#exibicaoProgress");
  const intervaloAtualizacao = 60000;
  const duracaoPorCartao = 10000;
  const duracaoIntro = 30000;
  let snapshotAtual = null;
  let snapshotPendente = null;
  let indice = 0;
  let pausado = false;
  let introAtiva = false;
  let timerAvanco = null;
  let timerIntro = null;

  function reiniciarAnimacao() {
    palco.classList.remove("is-changing");
    void palco.offsetWidth;
    palco.classList.add("is-changing");
  }

  function limparTimerAvanco() {
    if (timerAvanco) window.clearTimeout(timerAvanco);
    timerAvanco = null;
  }

  function agendarAvanco() {
    limparTimerAvanco();
    if (!snapshotAtual || pausado || introAtiva) return;
    const quantidadeCartoes = indice < snapshotAtual.secoes.length
      ? snapshotAtual.secoes[indice].linhas.length
      : 1;
    timerAvanco = window.setTimeout(() => {
      avancar();
      agendarAvanco();
    }, Math.max(1, quantidadeCartoes) * duracaoPorCartao);
  }

  function mostrarIntro() {
    introAtiva = true;
    limparTimerAvanco();
    palco.innerHTML = '<div class="painel-exibicao-intro"><img src="/imagens/logo_agl.png" alt="AGL"><div class="painel-exibicao-toggle" aria-hidden="true"><span></span></div></div>';
    progress.style.width = "0%";
    reiniciarAnimacao();
    if (timerIntro) window.clearTimeout(timerIntro);
    timerIntro = window.setTimeout(() => {
      if (snapshotPendente) {
        snapshotAtual = snapshotPendente;
        snapshotPendente = null;
      }
      indice = 0;
      introAtiva = false;
      renderAtual();
      agendarAvanco();
    }, duracaoIntro);
  }

  function renderSecao(secao) {
    const observacao = secao.ultima_observacao || "Nenhuma observação registrada";
    const classeGrade = secao.linhas.length > 1 ? "painel-exibicao-lines painel-exibicao-lines--multi" : "painel-exibicao-lines";
    palco.innerHTML = `<header class="painel-exibicao-section__header"><div><p class="eyebrow">SEÇÃO EM PRODUÇÃO</p><h2>${esc(secao.titulo)}</h2><p>${secao.linhas.length} linha(s) ativa(s)</p></div><span class="painel-exibicao-count">${secao.linhas.length} linhas</span></header><div class="${classeGrade}">${secao.linhas.map((item) => `<article class="painel-exibicao-line"><header class="painel-exibicao-line__header"><div><h3>${esc(item.linha)}</h3><p class="painel-exibicao-line__op">OP ${esc(item.op)} · ${esc(item.codigo)} · ${esc(item.descricao)}</p></div><span class="painel-exibicao-line__status">${esc(item.status || "Em fila")}</span></header><div class="painel-exibicao-line__metrics"><div><span>Programada</span><strong>${fmt(item.quantidade_programada)}</strong></div><div><span>Apontada</span><strong>${fmt(item.quantidade_apontada)}</strong></div><div><span>Deveria produzir</span><strong>${item.metricas_disponiveis ? fmt(item.quantidade_deveria_produzida) : "-"}</strong></div><div><span>Desempenho</span><strong>${item.metricas_disponiveis && item.diferenca_eficiencia != null ? `${item.diferenca_eficiencia > 0 ? "+" : ""}${fmt(item.diferenca_eficiencia)} un` : "-"}</strong></div></div><div class="painel-exibicao-line__timeline"><div><span>Previsão de saída</span><strong>${esc(item.previsao_saida)}</strong></div><div><span>Início da fila</span><strong>${esc(item.hora_inicio_fila)}</strong></div><div><span>Último apontamento</span><strong>${esc(item.ultimo_apontamento)}</strong></div></div></article>`).join("")}</div><div class="painel-exibicao-line__observation"><span>Última observação da seção</span><p>${esc(observacao)}</p></div>`;
  }

  function renderRanking(periodo, titulo) {
    const ranking = snapshotAtual.ranking[periodo];
    const tituloPeriodo = periodo === "dia" && !ranking.dia_eh_atual
      ? `Produção de ${ranking.data_referencia}`
      : titulo;
    const descricaoPeriodo = periodo === "dia" && !ranking.dia_eh_atual
      ? `Último dia com apontamentos · ${ranking.data_referencia}`
      : (periodo === "dia" ? "Hoje" : "Últimos 7 dias");
    const rows = ranking.linhas.map((item) => `<tr><td class="painel-exibicao-ranking__rank">${item.rank}</td><td>${esc(item.secao_titulo)}</td><td>${esc(item.linha)}</td><td>${esc(item.operador)}</td><td>${fmt(item.quantidade)}</td><td>${fmt(item.media_por_hora)} un/h</td></tr>`).join("");
    const resumoSecoes = (ranking.secoes || []).map((item) => `<tr><td>${esc(item.secao_titulo)}</td><td>${fmt(item.programada)}</td><td>${fmt(item.produzido)}</td><td>${fmt(item.media_por_hora)} un/h</td><td>${item.variacao > 0 ? "+" : ""}${fmt(item.variacao)} un</td></tr>`).join("");
    palco.innerHTML = `<header class="painel-exibicao-ranking__header"><div><p class="eyebrow">RANKING DE PRODUÇÃO</p><h2>${tituloPeriodo}</h2><p>Classificação por seção, linha e operador</p></div></header><div class="painel-exibicao-ranking__totals"><div><span>Total produzido</span><strong>${fmt(ranking.total)}</strong></div><div><span>Média por hora</span><strong>${fmt(ranking.media_por_hora)} un/h</strong></div><div><span>Período</span><strong>${descricaoPeriodo}</strong></div></div><div class="painel-exibicao-section-summary"><h3>Produção por seção</h3><table><thead><tr><th>Seção</th><th>Programada</th><th>Produzida</th><th>Média/h</th><th>Variação</th></tr></thead><tbody>${resumoSecoes || `<tr><td colspan="5">Nenhum apontamento registrado no período.</td></tr>`}</tbody></table></div><div class="painel-exibicao-ranking__table-wrap"><table class="painel-exibicao-ranking__table"><thead><tr><th>#</th><th>Seção</th><th>Linha</th><th>Operador</th><th>Produzido</th><th>Média/h</th></tr></thead><tbody>${rows || `<tr><td colspan="6">Nenhum apontamento registrado ${periodo === "dia" ? "no período" : "nos últimos 7 dias"}.</td></tr>`}</tbody></table></div>`;
  }

  function renderAtual() {
    if (!snapshotAtual) return;
    const totalSlides = snapshotAtual.secoes.length + 2;
    if (indice < snapshotAtual.secoes.length) {
      renderSecao(snapshotAtual.secoes[indice]);
    } else if (indice === snapshotAtual.secoes.length) {
      renderRanking("dia", "Produção de hoje");
    } else {
      renderRanking("semana", "Produção da semana");
    }
    progress.style.width = `${((indice + 1) / totalSlides) * 100}%`;
    reiniciarAnimacao();
  }

  function avancar(forcar = false) {
    if (!snapshotAtual || (pausado && !forcar)) return;
    const totalSlides = snapshotAtual.secoes.length + 2;
    indice += 1;
    if (indice >= totalSlides) {
      if (snapshotPendente) {
        snapshotAtual = snapshotPendente;
        snapshotPendente = null;
      }
      indice = 0;
      mostrarIntro();
      return;
    }
    renderAtual();
  }

  async function atualizarDados() {
    try {
      const resposta = await fetch("/api/painel-producao/exibicao", { cache: "no-store" });
      if (!resposta.ok) throw new Error("Falha ao carregar dados");
      const dados = await resposta.json();
      if (snapshotAtual) snapshotPendente = dados;
      else {
        snapshotAtual = dados;
        renderAtual();
        agendarAvanco();
      }
      $("#exibicaoAtualizado").textContent = `Atualizado em ${dados.atualizado_em}`;
    } catch (error) {
      if (!snapshotAtual) palco.innerHTML = '<div class="painel-exibicao-empty">Não foi possível carregar o painel.</div>';
    }
  }

  function alternarPausa() {
    pausado = !pausado;
    $("#exibicaoPausar").textContent = pausado ? "Retomar exibição" : "Pausar exibição";
    if (pausado) limparTimerAvanco();
    else if (!introAtiva) agendarAvanco();
  }

  atualizarDados();
  window.setInterval(atualizarDados, intervaloAtualizacao);
  $("#exibicaoPausar").addEventListener("click", alternarPausa);
  document.addEventListener("keydown", (event) => {
    if (event.target.matches("input, select, textarea, button, a")) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      avancar(true);
      if (!introAtiva) agendarAvanco();
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (!snapshotAtual) return;
      const totalSlides = snapshotAtual.secoes.length + 2;
      indice = (indice - 1 + totalSlides) % totalSlides;
      renderAtual();
      agendarAvanco();
    }
    if (event.key === " " || event.key.toLowerCase() === "p") {
      event.preventDefault();
      alternarPausa();
    }
  });
})();
