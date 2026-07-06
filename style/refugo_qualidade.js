document.addEventListener("DOMContentLoaded", () => {

    let dadosGlobais = [];
    let exibindoContados = false;
    let itemSelecionado = null;

    const tabela = document.getElementById("tabelaItens");
    const status = document.getElementById("statusMessage");
    const titulo = document.getElementById("tituloPagina");
    const btnAlternar = document.getElementById("btnAlternar");
    const btnAtualizar = document.getElementById("btnAtualizar");

    const modalColeta = document.getElementById("modalColeta");

    // =========================
    // CARREGAR PENDENTES
    // =========================
    async function carregarDados() {
        try {
            status.textContent = "Carregando itens...";

            const response = await fetch("/api/buscar-produtos");

            if (!response.ok) throw new Error("Erro API");

            dadosGlobais = await response.json();

            renderizarTabela(dadosGlobais);

            status.textContent = `Total: ${dadosGlobais.length} itens`;

        } catch (err) {
            console.error(err);
            status.textContent = "Erro ao carregar itens";
        }
    }

    // =========================
    // CONTADOS HOJE (CORRIGIDO)
    // =========================
    async function carregarContadosHoje() {
        try {
            status.textContent = "Carregando contados...";

            const response = await fetch("/api/contados-hoje");

            if (!response.ok) throw new Error("Erro API");

            const dados = await response.json();

            dadosGlobais = dados.itens ?? dados ?? [];

            renderizarTabela(dadosGlobais);

            status.textContent = `Total: ${dadosGlobais.length}`;

        } catch (err) {
            console.error(err);
            status.textContent = "Erro ao carregar contados";
        }
    }

    // =========================
    // RENDER
    // =========================
    function renderizarTabela(lista) {

        tabela.innerHTML = "";

        lista.forEach(item => {

            const tr = document.createElement("tr");

            const dataFormatada = item.data_hora
                ? new Date(item.data_hora).toLocaleString("pt-BR")
                : "-";

            if (exibindoContados) {

                tr.innerHTML = `
                    <td>${item.codigo}</td>
                    <td>${item.descricao}</td>
                    <td>${item.quantidade ?? 1}</td>
                    <td>${dataFormatada}</td>
                `;

                tr.classList.add("hoje");
            } else {

                tr.innerHTML = `
                    <td>${item.codigo}</td>
                    <td>${item.descricao}</td>
                `;
            }

            tr.addEventListener("click", () => abrirColeta(item));

            tabela.appendChild(tr);
        });
    }

    // =========================
    // MODAL
    // =========================
    function abrirColeta(item) {

        itemSelecionado = item;

        document.getElementById("c_codigo").textContent = item.codigo;
        document.getElementById("c_descricao").textContent = item.descricao;

        document.getElementById("c_quantidade").value = "";
        document.getElementById("c_local").value = "DZ";

        modalColeta.classList.remove("hidden");
    }

    function fecharColeta() {
        modalColeta.classList.add("hidden");
        itemSelecionado = null;
    }

    // =========================
    // SALVAR
    // =========================
    async function salvarColeta() {

        if (!itemSelecionado) return;

        const payload = {
            codigo: itemSelecionado.codigo,
            quantidade: parseInt(document.getElementById("c_quantidade").value || 0),
            local: document.getElementById("c_local").value
        };

        try {

            const res = await fetch("/api/registrar-coleta", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error();

            fecharColeta();

            exibindoContados
                ? await carregarContadosHoje()
                : await carregarDados();

            status.textContent = "Coleta registrada com sucesso!";

        } catch (err) {
            console.error(err);
            status.textContent = "Erro ao registrar coleta";
        }
    }

    // =========================
    // BOTÕES
    // =========================
    btnAtualizar?.addEventListener("click", () => {
        exibindoContados ? carregarContadosHoje() : carregarDados();
    });

    btnAlternar?.addEventListener("click", async () => {

        exibindoContados = !exibindoContados;

        if (exibindoContados) {
            titulo.textContent = "Itens contados hoje";
            btnAlternar.textContent = "Mostrar pendentes";
            await carregarContadosHoje();
        } else {
            titulo.textContent = "Fila de contagem de refugos";
            btnAlternar.textContent = "Mostrar contados hoje";
            await carregarDados();
        }

    });

    document.getElementById("btnSalvarColeta")?.addEventListener("click", salvarColeta);
    document.getElementById("btnFecharColeta")?.addEventListener("click", fecharColeta);

    // =========================
    // INICIAL
    // =========================
    carregarDados();


    // =========================
    // SIDEBAR
    // =========================
    const sidebar = document.getElementById("configSidebar");
    const btnConfig = document.getElementById("config-button");
    const fecharSidebar = document.getElementById("fecharSidebar");
    const btnDownloadHistorico = document.getElementById("btnDownloadHistorico");

    const btnDownload = document.getElementById("btnDownloadBase");
    const inputUpload = document.getElementById("inputUploadBase");

    btnConfig?.addEventListener("click", () => sidebar.classList.add("open"));

    fecharSidebar?.addEventListener("click", () => sidebar.classList.remove("open"));

    // =========================
    // DOWNLOAD BASE (CORRIGIDO)
    // =========================

    document.querySelectorAll(".titulo-gatilho").forEach(titulo => {
        titulo.addEventListener("click", () => {
            const secao = titulo.closest(".secao-retratil");
            secao.classList.toggle("ativo");
        });
    });
    
    btnDownloadHistorico?.addEventListener("click", async () => {
        try {

            const res = await fetch("/historico/download");

            if (!res.ok) {
                throw new Error("Erro ao baixar histórico");
            }

            const blob = await res.blob();

            const url = window.URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = "registro_refugos.xlsx";
            document.body.appendChild(a);
            a.click();
            a.remove();

            window.URL.revokeObjectURL(url);

        } catch (err) {
            console.error(err);
            alert("Erro ao baixar histórico.");
        }
    });


    btnDownload?.addEventListener("click", async () => {

        try {

            const res = await fetch("/base/download");

            if (!res.ok) throw new Error("Erro download");

            const blob = await res.blob();

            const url = window.URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = "base_itens_refugo.xlsx";
            document.body.appendChild(a);
            a.click();
            a.remove();

        } catch (err) {
            console.error(err);
            alert("Erro ao baixar base");
        }
    });

    // =========================
    // UPLOAD BASE
    // =========================
    inputUpload?.addEventListener("change", async (e) => {

        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        try {

            const res = await fetch("/base/upload", {
                method: "POST",
                body: formData
            });

            if (!res.ok) throw new Error("Erro upload");

            alert("Base atualizada com sucesso!");

        } catch (err) {
            console.error(err);
            alert("Erro ao enviar base");
        }
    });

});

