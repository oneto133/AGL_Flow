document.addEventListener("DOMContentLoaded", () => {

    let dadosGlobais = [];
    let pagina = 0;
    const porPagina = 10;

    const tabela = document.getElementById("tabelaItens");
    const status = document.getElementById("statusMessage");

    let itemSelecionado = null;

    async function carregarDados() {
        try {
            status.textContent = "Carregando itens...";

            const response = await fetch("/api/itens-a-contar");

            if (!response.ok) {
                throw new Error("Erro na API");
            }

            dadosGlobais = await response.json();

            tabela.innerHTML = "";
            pagina = 0;

            renderizarPagina();

            status.textContent = `Total: ${dadosGlobais.length} itens`;

        } catch (err) {
            console.error(err);
            status.textContent = "Erro ao carregar itens";
        }
    }

    function renderizarPagina() {
        const inicio = pagina * porPagina;
        const fim = inicio + porPagina;

        const itens = dadosGlobais.slice(inicio, fim);

        itens.forEach(item => {
            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${item.codigo}</td>
                <td>${item.descricao}</td>
            `;

            tr.addEventListener("pointerdown", () => {
                tr.dataset.start = Date.now();
            });

            tr.addEventListener("pointerup", () => {

                const start = parseInt(tr.dataset.start || "0");
                const diff = Date.now() - start;

                if (diff < 500) {
                    abrirModal(item);
                }
            });

            tabela.appendChild(tr);
        });

        pagina++;
    }

    function abrirModal(item) {
        itemSelecionado = item;

        document.getElementById("m_codigo").textContent = item.codigo;
        document.getElementById("m_descricao").textContent = item.descricao;
        document.getElementById("m_total").textContent = item.total_contagens;
        document.getElementById("m_ultima").textContent = item.ultima_contagem;
        document.getElementById("m_media").textContent = item.media_dias;
        document.getElementById("m_proxima").textContent = item.proxima_contagem;

        document.getElementById("modalAcao").classList.remove("hidden");
    }

    document.getElementById("btnCancelar").addEventListener("click", () => {
        document.getElementById("modalAcao").classList.add("hidden");
        itemSelecionado = null;
    });

    document.getElementById("btnContar").addEventListener("click", () => {
        if (!itemSelecionado) return;
        window.location.href = `/inventario?codigo=${itemSelecionado.codigo}`;
    });

    // 🔥 SÓ CARREGA QUANDO CLICA
    document.getElementById("btnAtualizar")
        .addEventListener("click", carregarDados);

});