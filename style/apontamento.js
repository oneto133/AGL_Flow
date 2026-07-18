const selectLinha = document.getElementById("linhaSelecao");
const selecaoOP = document.getElementById("selecaoOP");

window.dadosOpsDaLinhaAtual = []


document.addEventListener("DOMContentLoaded", function() {
    carregarSecoes();

    const selectSecao = document.getElementById("secaoSelecao");
    if (selectSecao){

        selectSecao.addEventListener("change", aoMudarSecao);
    }

    if (selectLinha) {
        selectLinha.addEventListener("change", function() {
            atualizar_ops_por_linha(this.value);
        });
    }

    if (selecaoOP) {
        selecaoOP.addEventListener("change", function(){
            retornar_dados_op(this.value);
        });
    }

    const form = document.getElementById("trelloForm");
    if(form) {
        form.addEventListener("submit", enviarApontamento);
    }
});

async function carregarSecoes() {
    const selectSecao = document.getElementById("secaoSelecao");
    if (!selectSecao) return;

    try {
        const resposta = await fetch("/api/qualidade/inspecoes/secoes");

        if (!resposta.ok) {
            throw new Error(`Erro no servidor: ${resposta.status}`);
        }

        const dados = await resposta.json();
        const secoes = Array.isArray(dados) ? dados: [];

        const totalLinhas = secoes.reduce((acc, secao) => acc + (secao.quantidade_linhas || 0), 0);
        const totalOPs = secoes.reduce((acc, secao) => acc + (secao.quantidade_ops || 0), 0);

        selectSecao.innerHTML = '<option value="" disabled selected>Selecione uma seção</option>';

        secoes.forEach(secao => {
            const option = document.createElement("option");

            option.value = secao.secao;
            option.textContent = secao.titulo;

            selectSecao.appendChild(option);
        });

        window.dadosSecoesCompletos = secoes;
    }
    catch (error) {
        console.error(error);
        selectSecao.innerHTML = '<option value="" disabled selected>Erro</option>'

    }
}

function aoMudarSecao() {

    const secaoSelecionada = this.value;
    if (selectLinha) {
        selectLinha.innerHTML = '<option value="" disabled selected>Selecione uma linha</option>';
    }

    if(selecaoOP) {
        selecaoOP.innerHTML = '<option value="" disabled selected>Selecione uma OP</option>';
    }

    if (!window.dadosSecoesCompletos || !secaoSelecionada) return;

    const dadosDaSecao = window.dadosSecoesCompletos.find(s => s.secao === secaoSelecionada);

    if(dadosDaSecao && Array.isArray(dadosDaSecao.linhas)) {
        atualizarDropdownLinhas(dadosDaSecao.linhas);
    }

}

function atualizarDropdownLinhas(linhas) {

    if (!selectLinha) return;

    selectLinha.innerHTML = '<option value="" disabled selected>Selecione uma linha</option>';


    if (linhas.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Nenhuma linha encontrada";
        option.disabled = true;
        selectLinha.appendChild(option);
        return;
    }

    linhas.forEach(linha => {
        const option = document.createElement("option");
        option.value = linha.celula_linha;
        option.textContent = linha.celula_linha;
        selectLinha.appendChild(option);
        return
    });

}

async function atualizar_ops_por_linha(linha) {

    if (!selecaoOP || !linha) return;

    try {
        const resposta = await fetch(`/api/qualidade/inspecoes/linha/${encodeURIComponent(linha)}`);

        if (!resposta.ok) {
            throw new Error (`Erro no servidor: ${resposta.status}`);
        }

        const dados = await resposta.json();
        const ops = Array.isArray(dados.ops) ? dados.ops: [];

        window.dadosOPsDaLinhaAtual = ops;

        selecaoOP.innerHTML = '<option value="" disabled selected>Selecione uma OP</option>';
        ops.forEach((op) => {
            const option = document.createElement("option");
            option.value = op.op;
            option.textContent = `${op.op} - ${op.codigo} - ${op.descricao}`;
            selecaoOP.appendChild(option);
        });

    }
    catch (error){
        console.error("Erro ao atualizar as OPs: ", error)
    }
}

async function retornar_dados_op(opSelecionada) {
    const painel = document.getElementById("painelResumo");

    if (!opSelecionada) {
        limparPainelInformativo();
        return;
    }

    const detalhesOP = window.dadosOPsDaLinhaAtual.find(o => String(o.op) === String(opSelecionada));

    if (detalhesOP) {
        document.getElementById("infoOP").textContent = detalhesOP.op || "-";
        document.getElementById("infoCodigo").textContent = detalhesOP.codigo || "-";
        document.getElementById("infoDescricao").textContent= detalhesOP.descricao || "-";
        document.getElementById("infoQtdProgramada").textContent = `${detalhesOP.quantidade || 0} un.`;

        const inputManualOP = document.getElementById("manualOP");
        if (inputManualOP) inputManualOP.value = detalhesOP.op;
    }

    if (painel) painel.style.display = "block";

    try{
        const resposta = await fetch(`/api/registro-apontamento?op=${encodeURIComponent(opSelecionada)}`);

        if (!resposta.ok) {
            throw new Error(`Erro ao buscar dados da OP: ${resposta.status}`);
        }
        const dados = await resposta.json();

        document.getElementById("infoQtdApontada").textContent = `${dados.quantidade_apontada}`;
        document.getElementById("infoUltimoApontamento").textContent = `${dados.quantidade_ultimo_apontamento}`;
        document.getElementById("infoDataHora").textContent = dados.ultima_data_hora;


    }
    catch (error) {
        console.error("Erro ao retornar os dados da OP: ", error);

        document.getElementById("infoQtdApontada").textContent = "Erro";
        document.getElementById("infoUltimoApontamento").textContent = "Erro";
        document.getElementById("infoDataHora").textContent = "Erro ao carregar data";
    }

}

function limparPainelInformativo() {
    const IDs = ["infoOP", "infoCodigo", "infoDescricao", "infoQtdProgramada", "infoQtdApontada", "infoUltimoApontamento", "infoDataHora"];
    IDs.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = "-";
    });
    
    const inputManualOP = document.getElementById("manualOP");
    if (inputManualOP) inputManualOP.value = "";

    // ESCONDE O PAINEL: Remove a área vazia da tela se o usuário resetar o formulário
    const painel = document.getElementById("painelResumo");
    if (painel) painel.style.display = "none";
}

async function enviarApontamento(event) {
    event.preventDefault();

    const statusMsg = document.getElementById("statusMessage");
    const opSelecionada = selecaoOP.value;

    const detalhesOP = window.dadosOPsDaLinhaAtual.find(o => String(o.op) === String(opSelecionada));

    if (!detalhesOP){
        if (statusMsg){
            statusMsg.textContent = "Erro: ordem de produção inválida.";
            statusMsg.style.color = "red";
        }
        return ;
    }

    const payload = {
        op: parseInt(detalhesOP.op),
        codigo: parseInt(detalhesOP.codigo),
        quantidade: parseInt(document.getElementById("manualQuantity").value, 10),
        status: String(document.getElementById("statusOP").value || "Em processo"),
        observacao: document.getElementById("observacao").value || ""
    };

    try {
        if (statusMsg) {
            statusMsg.textContent = "Registrando Apontamento...";
            statusMsg.style.color = "#555";
        }

        const resposta = await fetch("/api/registrar-apontamento", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        }
        );

        const resultado = await resposta.json();

        if (!resposta.ok){
            throw new Error(resultado.detail || "Erro ao registrar apontamento")
        }

        if (statusMsg) {
            statusMsg.textContent = "Apontamento registrado com sucesso."
            statusMsg.style.color = "green";
        }

        document.getElementById("manualQuantity").value = "1";
        document.getElementById("statusOP").value = "";
        document.getElementById("observacao").value = "";

        retornar_dados_op(opSelecionada);
    }

    catch (error){
        console.error("Erro no envio: ", error);
        if (statusMsg) {
            statusMsg.textContent = `Falha: ${error.message}`;
            statusMsg.style.color = "red";
        }
    }
}