(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "-").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[char]));
  const fmt = (value) => new Intl.NumberFormat("pt-BR").format(Number(value || 0));
  let secoes = [];

  function preencherLinhas() {
    const grupo = secoes.find((item) => item.secao === $("filtroSecao").value);
    $("filtroLinha").innerHTML = '<option value="">Todas as linhas</option>';
    (grupo ? grupo.linhas : secoes.flatMap((item) => item.linhas || [])).forEach((item) => {
      const option = document.createElement("option");
      option.value = item.celula_linha;
      option.textContent = item.celula_linha;
      $("filtroLinha").appendChild(option);
    });
  }

  function desenhar(dados) {
    const canvas = $("grafico");
    const tooltip = $("graficoTooltip");
    const ctx = canvas.getContext("2d");
    const cssW = canvas.clientWidth || 900;
    const cssH = 420;
    const ratio = window.devicePixelRatio || 1;
    const margemEsquerda = 52;
    const margemDireita = 24;
    const margemTopo = 22;
    const margemBase = 55;
    const larguraUtil = cssW - margemEsquerda - margemDireita;
    const alturaUtil = cssH - margemTopo - margemBase;
    const pontos = dados.pontos || [];
    const maximo = Math.max(1, ...pontos.flatMap((ponto) => [ponto.programado, ponto.produzido]));
    const x = (indice) => pontos.length < 2
      ? margemEsquerda + larguraUtil / 2
      : margemEsquerda + indice * larguraUtil / (pontos.length - 1);
    const y = (valor) => cssH - margemBase - Number(valor || 0) / maximo * alturaUtil;
    const tipo = $("filtroTipo").value;

    canvas.width = cssW * ratio;
    canvas.height = cssH * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.font = "11px sans-serif";
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.fillStyle = "#dce8f2";
    ctx.beginPath();
    ctx.moveTo(margemEsquerda, margemTopo);
    ctx.lineTo(margemEsquerda, cssH - margemBase);
    ctx.lineTo(cssW - margemDireita, cssH - margemBase);
    ctx.stroke();

    if (!pontos.length) {
      ctx.fillText("Nenhum apontamento encontrado", margemEsquerda, cssH / 2);
      tooltip.hidden = true;
      return;
    }

    const series = [["programado", "#a8d8f0"], ["produzido", "#1fba74"]];
    if (tipo === "bar") {
      const intervalo = larguraUtil / Math.max(1, pontos.length);
      const larguraBarra = Math.max(10, intervalo * 0.32);
      pontos.forEach((ponto, indice) => series.forEach(([campo, cor], serie) => {
        const altura = Number(ponto[campo] || 0) / maximo * alturaUtil;
        ctx.fillStyle = cor;
        ctx.fillRect(
          margemEsquerda + indice * intervalo + intervalo / 2 - larguraBarra + serie * larguraBarra,
          cssH - margemBase - altura,
          larguraBarra - 3,
          altura,
        );
      }));
    } else {
      series.forEach(([campo, cor]) => {
        ctx.strokeStyle = cor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        pontos.forEach((ponto, indice) => indice
          ? ctx.lineTo(x(indice), y(ponto[campo]))
          : ctx.moveTo(x(indice), y(ponto[campo])));
        ctx.stroke();
      });
    }

    const rotulosVisiveis = Math.max(1, Math.floor(larguraUtil / 82));
    const passoRotulo = Math.max(1, Math.ceil(pontos.length / rotulosVisiveis));
    ctx.fillStyle = "#dce8f2";
    ctx.textAlign = "center";
    pontos.forEach((ponto, indice) => {
      if (indice % passoRotulo !== 0 && indice !== pontos.length - 1) return;
      ctx.fillText(ponto.data, x(indice), cssH - 20);
    });

    const mostrarTooltip = (event) => {
      const rect = canvas.getBoundingClientRect();
      const posicao = Math.max(margemEsquerda, Math.min(cssW - margemDireita, event.clientX - rect.left));
      const indice = pontos.length < 2
        ? 0
        : Math.round((posicao - margemEsquerda) / (larguraUtil / (pontos.length - 1)));
      const ponto = pontos[Math.max(0, Math.min(pontos.length - 1, indice))];
      tooltip.innerHTML = `<strong>${esc(ponto.data)}</strong><br>Produzido: ${fmt(ponto.produzido)} un<br>Programado: ${fmt(ponto.programado)} un<br>Eficiência: ${fmt(ponto.eficiencia)}%`;
      tooltip.hidden = false;
      tooltip.style.left = `${Math.min(rect.width - 190, Math.max(8, event.clientX - rect.left + 12))}px`;
      tooltip.style.top = `${Math.max(8, event.clientY - rect.top - 66)}px`;
    };
    canvas.onmousemove = mostrarTooltip;
    canvas.onmouseleave = () => { tooltip.hidden = true; };
  }

  async function carregar() {
    const params = new URLSearchParams({
      secao: $("filtroSecao").value,
      linha: $("filtroLinha").value,
      periodo: $("filtroPeriodo").value,
    });
    const dados = await fetch(`/api/painel-producao/eficiencia?${params}`).then((response) => response.json());
    $("tituloGrafico").textContent = `Eficiência · ${$("filtroLinha").value || $("filtroSecao").value || "geral"}`;
    $("indicador").innerHTML = `<strong>${dados.totais.eficiencia}%</strong><span>${fmt(dados.totais.produzido)} produzidos de ${fmt(dados.totais.programado)} programados</span>`;
    desenhar(dados);
    $("resumo").innerHTML = (dados.resumo || []).map((item) => `<div><b>${esc(item.linha)}</b><span>${fmt(item.produzido)} / ${fmt(item.programado)} · ${item.eficiencia}%</span></div>`).join("") || "Nenhum histórico encontrado.";
  }

  fetch("/api/qualidade/inspecoes/secoes")
    .then((response) => response.json())
    .then((data) => {
      secoes = data;
      $("filtroSecao").innerHTML = '<option value="">Todas as seções</option>';
      data.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.secao;
        option.textContent = item.titulo;
        $("filtroSecao").appendChild(option);
      });
      preencherLinhas();
      carregar();
    });
  $("filtroSecao").addEventListener("change", preencherLinhas);
  $("btnFiltrar").addEventListener("click", carregar);
  $("filtroTipo").addEventListener("change", carregar);
  $("btnImprimir").addEventListener("click", () => window.print());
})();
