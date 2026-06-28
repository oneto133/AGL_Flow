const form = document.getElementById("inventarioForm");

const codigo = document.getElementById("codigo");
const descricao = document.getElementById("descricao");
const sistema = document.getElementById("sistema");
const media = document.getElementById("media");

const galpao = document.getElementById("galpao");

const divergencia = document.getElementById("divergencia");
const porcentagem = document.getElementById("porcentagem");

const tipo = document.getElementById("tipo");
const observacao = document.getElementById("observacao");

const statusMessage = document.getElementById("statusMessage");

const params = new URLSearchParams(window.location.search);
const codigoURL = params.get("codigo");

if (codigo) {
    document.getElementById("codigo").value = codigo;
    document.getElementById("codigo").dispatchEvent(new Event("change"));
}

// =======================================
// MENSAGENS
// =======================================

function mostrarMensagem(texto, sucesso = true) {

    statusMessage.textContent = texto;

    statusMessage.style.color =
        sucesso
            ? "#2E7D32"
            : "#C62828";

}

// =======================================
// LIMPA FORMULÁRIO
// =======================================

function limparFormulario() {

    form.reset();

    descricao.value = "";
    sistema.value = "";
    media.value = "";

    divergencia.value = "";
    porcentagem.value = "";

    codigo.focus();

}

// =======================================
// BUSCA DADOS
// =======================================

async function buscarDadosProduto() {

    if (!codigo.value)
        return;

    try {

        mostrarMensagem("Buscando item...", true);

        const response = await fetch(
            `/api/buscar-dados?codigo=${codigo.value}`
        );

        if (!response.ok)
            throw new Error();

        const dados = await response.json();

        descricao.value = dados.descricao;
        sistema.value = dados.sistema;
        media.value = dados.media + " dias";

        galpao.focus();

        mostrarMensagem("Produto encontrado.", true);

    }

    catch {

        descricao.value = "";
        sistema.value = "";
        media.value = "";

        divergencia.value = "";
        porcentagem.value = "";

        mostrarMensagem("Produto não encontrado.", false);

    }

}

// =======================================
// CALCULA DIVERGÊNCIA
// =======================================

function calcularDivergencia() {

    const estoqueSistema = Number(sistema.value);

    const estoqueGalpao = Number(galpao.value);

    if (!estoqueSistema && estoqueSistema !== 0)
        return;

    const diferenca = Math.abs(
        estoqueSistema - estoqueGalpao
    );

    divergencia.value = diferenca;

    if (estoqueSistema == 0) {

        porcentagem.value = "0%";

    } else {

        porcentagem.value =
            ((diferenca / estoqueSistema) * 100)
                .toFixed(2) + "%";

    }

}

// =======================================
// REGISTRAR CONTAGEM
// =======================================

async function registrarContagem() {

    const body = {

        codigo: Number(codigo.value),

        galpao: Number(galpao.value),

        tipo: tipo.value,

        observacao: observacao.value

    };

    const response = await fetch(

        "/api/registrar-contagem",

        {

            method: "POST",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify(body)

        }

    );

    if (!response.ok)
        throw new Error();

    return await response.json();

}

// =======================================
// VALIDA FORMULÁRIO
// =======================================

function validarFormulario() {

    if (!codigo.value) {

        mostrarMensagem("Informe o código.", false);

        codigo.focus();

        return false;

    }

    if (!galpao.value) {

        mostrarMensagem("Informe a quantidade.", false);

        galpao.focus();

        return false;

    }

    return true;

}

async function carregarCodigoInicial() {
    if (!codigoURL) return;

    codigo.value = codigoURL;

    await buscarDadosProduto();
}

// =======================================
// ENVIAR
// =======================================

form.addEventListener(

    "submit",

    async (e) => {

        e.preventDefault();

        if (!validarFormulario())
            return;

        try {

            mostrarMensagem(
                "Registrando contagem...",
                true
            );

            const resposta =
                await registrarContagem();

            mostrarMensagem(
                resposta.mensagem,
                true
            );

            limparFormulario();

        }

        catch {

            mostrarMensagem(
                "Erro ao registrar contagem.",
                false
            );

        }

    }

);

codigo.addEventListener("change", buscarDadosProduto);
codigo.addEventListener(

    "keydown",

    (e) => {

        if (e.key === "Enter") {

            e.preventDefault();

            buscarDadosProduto();

        }

    }

);

// Atualiza divergência

galpao.addEventListener(

    "input",

    calcularDivergencia

);

// Enter na quantidade envia direto

galpao.addEventListener(

    "keydown",

    (e) => {

        if (e.key === "Enter") {

            e.preventDefault();

            form.requestSubmit();

        }

    }

);

// Início
window.addEventListener("load", carregarCodigoInicial);
codigo.focus();