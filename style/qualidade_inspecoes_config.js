document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById("configSidebar");
  const btnConfig = document.getElementById("config-button");
  const fecharSidebar = document.getElementById("fecharSidebar");
  const btnDownloadHistorico = document.getElementById("btnDownloadHistorico");
  
  const btnDownloadBase = document.getElementById("btnDownloadBase");
  const inputUploadBase = document.getElementById("inputUploadBase");
  const inputUploadBaseQualidade = document.getElementById("inputUploadBaseQualidade");

  const btnDownloadBaseQualidade = document.getElementById("btnDownloadBaseQualidade");
  

  if (!sidebar) {
    return;
  }

  btnConfig?.addEventListener("click", () => {
    sidebar.classList.add("open");
  });

  fecharSidebar?.addEventListener("click", () => {
    sidebar.classList.remove("open");
  });

  document.querySelectorAll(".titulo-gatilho").forEach((titulo) => {
    titulo.addEventListener("click", () => {
      const secao = titulo.closest(".secao-retratil");
      secao?.classList.toggle("ativo");
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

 btnDownloadBaseQualidade?.addEventListener("click", async () => {
    try {
      const res = await fetch("/base/inspecoes-deslizantes");
      if (!res.ok) {
        throw new Error("Erro ao baixar histórico");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "base_qualidade.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Erro ao baixar histórico.");
    }
  });

  btnDownloadBase?.addEventListener("click", async () => {
    try {
      const res = await fetch("/base/download");
      if (!res.ok) {
        throw new Error("Erro download");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "base_itens_refugo.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Erro ao baixar base");
    }
  });

  inputUploadBase?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/base/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Erro upload");
      }

      alert("Base atualizada com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao enviar base");
    } finally {
      inputUploadBase.value = "";
    }
  });

  inputUploadBaseQualidade?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/base/qualidade/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Erro upload");
      }

      alert("Base atualizada com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao enviar base");
    } finally {
      inputUploadBase.value = "";
    }
  });
});
