const loginForm = document.querySelector("#loginForm");
const loginStatus = document.querySelector("#loginStatus");

function setStatus(message, type = "") {
  if (!loginStatus) {
    return;
  }

  loginStatus.textContent = message;
  loginStatus.className = `login-status ${type}`.trim();
}

loginForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const user = document.querySelector("#loginUser")?.value?.trim() || "";
  const password = document.querySelector("#loginPassword")?.value || "";

  if (user === "admin" && password === "123456") {
    setStatus("Acesso liberado. Redirecionando...", "success");
    window.location.replace("/tela_inicial");
    return;
  }

  setStatus("Usuário ou senha inválidos.", "error");
});
