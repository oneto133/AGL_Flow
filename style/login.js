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
    localStorage.setItem("etiquetas-auth", "1");
    setStatus("Acesso liberado. Redirecionando...", "success");
    window.location.replace("/reposicao");
    return;
  }

  setStatus("Usuário ou senha inválidos.", "error");
});

if (localStorage.getItem("etiquetas-auth") && window.location.pathname === "/") {
  window.location.replace("/reposicao");
}
