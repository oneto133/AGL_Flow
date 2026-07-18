const selectLinha = document.getElementById("linhaSelecao");
const selecaoOP = document.getElementById("selecaoOP");


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

        selecaoOP.innerHTML = '<option value="" disabled selected>Selecione uma OP</option>';
        ops.forEach((op) => {
            const option = document.createElement("option");
            option.value = op.op;
            option.textContent = `${op.op} - ${op.codigo}`;
            selecaoOP.appendChild(option);
        });

    }
    catch (error){
        console.error("Erro ao atualizar as OPs: ", error)
    }


    
}