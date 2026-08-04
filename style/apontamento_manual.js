(() => {
  const $ = id => document.getElementById(id);
  const secao = $("manualSecao"), linhas = $("manualLinhas");
  async function carregar() {
    const dados = await fetch("/api/qualidade/inspecoes/secoes").then(r => r.json());
    secao.innerHTML = '<option value="">Selecione uma seção</option>';
    const nomes = [];
    dados.forEach(item => { const op = document.createElement("option"); op.value = item.secao; op.textContent = item.titulo; secao.appendChild(op); (item.linhas || []).forEach(linha => nomes.push(linha.celula_linha)); });
    linhas.innerHTML = [...new Set(nomes)].map(nome => `<option value="${nome}">`).join("");
  }
  $("manualCodigo").addEventListener("change", async () => { const codigo = $("manualCodigo").value.trim(); if (!codigo) return; const dado = await fetch(`/api/produto?codigo=${encodeURIComponent(codigo)}`).then(r => r.json()); if (dado.descricao) $("manualDescricao").value = dado.descricao; });
  $("manualForm").addEventListener("submit", async event => { event.preventDefault(); const msg = $("manualStatusMsg"); msg.textContent = "Registrando…"; const resposta = await fetch("/api/registrar-apontamento", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({op:Number($("manualOP").value), codigo:Number($("manualCodigo").value), quantidade:Number($("manualQuantidade").value), status:$("manualStatus").value, observacao:$("manualObservacao").value, manual:true, secao:$("manualSecao").value, linha:$("manualLinha").value.trim(), descricao:$("manualDescricao").value.trim()})}); const resultado = await resposta.json(); msg.textContent = resposta.ok ? "Apontamento registrado com sucesso." : (resultado.detail || "Não foi possível registrar."); });
  carregar().catch(() => { secao.innerHTML = '<option value="">Não foi possível carregar seções</option>'; });
})();
