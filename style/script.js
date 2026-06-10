const statusMessage = document.querySelector("#statusMessage");
const itemsList = document.querySelector("#itemsList");
const refreshButton = document.querySelector("#refreshButton");
const printAllButton = document.querySelector("#printAllButton");
const menuButton = document.querySelector("#menuButton");
const mobileMenu = document.querySelector("#mobileMenu");
const themeButton = document.querySelector("#themeButton");
const mobileThemeButton = document.querySelector("#mobileThemeButton");
const labelConfigButton = document.querySelector("#labelConfigButton");
const mobileLabelConfigButton = document.querySelector("#mobileLabelConfigButton");
const mobileSettingsButton = document.querySelector("#mobileSettingsButton");
const mobileRefreshButton = document.querySelector("#mobileRefreshButton");
const settingsButton = document.querySelector("#settingsButton");
const reposicaoUpdatedAt = document.querySelector("#reposicaoUpdatedAt");
const serverAddress = document.querySelector("#serverAddress");
const mobileReposicaoUpdatedAt = document.querySelector("#mobileReposicaoUpdatedAt");
const mobileServerAddress = document.querySelector("#mobileServerAddress");
const manualForm = document.querySelector("#manualForm");
const manualCode = document.querySelector("#manualCode");
const manualQuantity = document.querySelector("#manualQuantity");
const manualSearchButton = document.querySelector("#manualSearchButton");
const manualResult = document.querySelector("#manualResult");

const settingsBackdrop = document.querySelector("#settingsBackdrop");
const settingsModal = document.querySelector("#settingsModal");
const closeSettingsButton = document.querySelector("#closeSettingsButton");
const cancelSettingsButton = document.querySelector("#cancelSettingsButton");
const resetSettingsButton = document.querySelector("#resetSettingsButton");
const settingsForm = document.querySelector("#settingsForm");
const settingsStatus = document.querySelector("#settingsStatus");

const configFields = {
  data_root: document.querySelector("#configDataRoot"),
  reposicao_csv: document.querySelector("#configReposicaoCsv"),
  labels_dir: document.querySelector("#configLabelsDir"),
  report_dir: document.querySelector("#configReportDir"),
  base_file: document.querySelector("#configBaseFile"),
  printer_name: document.querySelector("#configPrinterName"),
  source_section_prefix: document.querySelector("#configSectionPrefix"),
  two_column_offset_dots: document.querySelector("#configTwoColumnOffsetDots"),
  label_width_dots: document.querySelector("#configLabelWidthDots"),
  label_height_dots: document.querySelector("#configLabelHeightDots"),
};

let currentConfig = null;
const THEME_STORAGE_KEY = "nova-pasta-theme";

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = `status ${type}`.trim();
}

function setSettingsStatus(message, type = "") {
  settingsStatus.textContent = message;
  settingsStatus.className = `settings-status ${type}`.trim();
}

function toggleMobileMenu(forceState) {
  if (!mobileMenu || !menuButton) {
    return;
  }

  const shouldOpen = typeof forceState === "boolean" ? forceState : mobileMenu.hidden;
  mobileMenu.hidden = !shouldOpen;
  menuButton.setAttribute("aria-expanded", String(shouldOpen));
}

function isMobileLayout() {
  return window.matchMedia("(max-width: 720px)").matches;
}

function getTheme() {
  return localStorage.getItem(THEME_STORAGE_KEY) || "dark";
}

function applyTheme(theme) {
  document.body.dataset.theme = theme === "day" ? "day" : "dark";
  localStorage.setItem(THEME_STORAGE_KEY, document.body.dataset.theme);
  const isDay = document.body.dataset.theme === "day";
  if (themeButton) {
    themeButton.textContent = isDay ? "Dia" : "Noite";
  }
  if (mobileThemeButton) {
        mobileThemeButton.textContent = isDay ? "Dia" : "Noite";
  }
}

function toggleTheme() {
  applyTheme(getTheme() === "day" ? "dark" : "day");
}

function openLabelConfigPage() {
  window.location.href = "/config-etiquetas";
}

function renderList(items) {
  itemsList.innerHTML = "";

  if (items.length === 0) {
    const message = document.createElement("p");
    message.className = "empty-message";
    message.textContent = "Nenhum codigo encontrado em csv/Reposicao e Diversos.csv.";
    itemsList.append(message);
    return;
  }

  for (const item of items) {
    const row = document.createElement("article");
    const info = document.createElement("div");
    const code = document.createElement("strong");
    const description = document.createElement("strong");
    const section = document.createElement("small");
    const barcode = document.createElement("span");
    const sold = document.createElement("small");
    const printed = document.createElement("small");
    const badge = document.createElement("span");
    const actions = document.createElement("div");
    const quantity = document.createElement("input");
    const button = document.createElement("button");

    row.className = "label-row";
    info.className = "label-info";
    actions.className = "label-actions";
    badge.className = item.automatico ? "badge ok" : "badge missing";
    quantity.className = "quantity-input";
    button.className = "primary-button";

    code.textContent = item.codigo;
    description.textContent = item.nome || "Sem descricao";
    section.textContent = item.secao || "Sem secao";
    barcode.textContent = item.codigo_barras ? `EAN ${item.codigo_barras}` : "EAN nao encontrado";
    sold.textContent = item.quantidade_vendida ? `Vendidas: ${item.quantidade_vendida}` : "Vendidas: 0";
    printed.textContent = `Impressas: ${item.quantidade_impresso || 0}`;
    printed.className = "label-printed";

    quantity.type = "number";
    quantity.min = "1";
    quantity.max = "500";
    quantity.value = item.quantidade_vendida || 1;
    quantity.title = "Quantidade";

    button.type = "button";
    button.textContent = "Imprimir";
    button.disabled = !item.automatico;
    button.addEventListener("click", () => printItem(item.codigo, quantity, button));

    description.className = "label-description";
    info.append(code, description, section, barcode, sold, printed);
    actions.append(badge, quantity, button);
    row.append(info, actions);
    itemsList.append(row);
  }
}

async function loadItems() {
  setStatus("Lendo csv/Reposicao e Diversos.csv...");

  try {
    const response = await fetch("/api/itens");
    if (!response.ok) {
      throw new Error("Nao foi possivel carregar os itens.");
    }

    const data = await response.json();
    reposicaoUpdatedAt.textContent = data.reposicao?.updated_at || "-";
    serverAddress.textContent = data.access_url || "-";
    mobileReposicaoUpdatedAt.textContent = data.reposicao?.updated_at || "-";
    mobileServerAddress.textContent = data.access_url || "-";
    renderList(data.items);
    setStatus("");
  } catch (error) {
    reposicaoUpdatedAt.textContent = "-";
    serverAddress.textContent = "-";
    mobileReposicaoUpdatedAt.textContent = "-";
    mobileServerAddress.textContent = "-";
    renderList([]);
    setStatus(error.message, "error");
  }
}

async function printItem(codigo, quantityInput, button) {
  const quantidade = Number(quantityInput.value);
  if (!codigo || quantidade < 1) {
    setStatus("Informe uma quantidade valida.", "error");
    return;
  }

  button.disabled = true;
  setStatus(`Enviando ${codigo} para o Zebra...`);

  try {
    const response = await fetch("/api/imprimir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ etiqueta: codigo, quantidade }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Falha ao imprimir.");
    }

    await loadItems();
    setStatus(`${data.quantidade} etiqueta(s) enviada(s): ${data.arquivo} | Impressora: ${data.impressora || "padrão"}`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    button.disabled = false;
  }
}

async function searchManualCode() {
  const codigo = manualCode.value.trim();
  if (!codigo) {
    manualResult.textContent = "Digite um codigo interno.";
    return;
  }

  manualResult.textContent = "Buscando na base...";
  try {
    const response = await fetch(`/api/base/${encodeURIComponent(codigo)}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "Codigo nao encontrado.");
    }

    const item = data.item;
    manualResult.textContent = `${item.codigo} - ${item.nome} - EAN ${item.codigo_barras || "nao encontrado"}`;
  } catch (error) {
    manualResult.textContent = error.message;
  }
}

async function printAllItems() {
  if (!window.confirm("Imprimir todas as etiquetas dos itens vendidos?")) {
    return;
  }

  setStatus("Enviando impressao de todos os itens vendidos...");
  printAllButton.disabled = true;

  try {
    const response = await fetch("/api/imprimir-todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "Falha ao imprimir tudo.");
    }

    await loadItems();
    setStatus(`${data.total_enviados} item(ns) enviados para impressao.`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    printAllButton.disabled = false;
  }
}

function openSettings() {
  settingsBackdrop.hidden = false;
  settingsModal.hidden = false;
  settingsModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  setSettingsStatus("");
}

function closeSettings() {
  settingsBackdrop.hidden = true;
  settingsModal.hidden = true;
  settingsModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  setSettingsStatus("");
}

function fillSettingsForm(config) {
  currentConfig = config;
  configFields.data_root.value = config.data_root || "";
  configFields.reposicao_csv.value = config.reposicao_csv || "";
  configFields.labels_dir.value = config.labels_dir || "";
  configFields.report_dir.value = config.report_dir || "";
  configFields.base_file.value = config.base_file || "";
  configFields.printer_name.value = config.printer_name || "";
  configFields.source_section_prefix.value = config.source_section_prefix || "";
  configFields.two_column_offset_dots.value = config.two_column_offset_dots ?? 330;
  configFields.label_width_dots.value = config.label_width_dots ?? 330;
  configFields.label_height_dots.value = config.label_height_dots ?? 200;
}

async function loadConfig() {
  try {
    const response = await fetch("/api/config");
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "Nao foi possivel carregar a configuracao.");
    }

    fillSettingsForm(data.config);
  } catch (error) {
    setSettingsStatus(error.message, "error");
  }
}

async function saveConfig(event) {
  event.preventDefault();

  const payload = {
    data_root: configFields.data_root.value.trim(),
    reposicao_csv: configFields.reposicao_csv.value.trim(),
    labels_dir: configFields.labels_dir.value.trim(),
    report_dir: configFields.report_dir.value.trim(),
    base_file: configFields.base_file.value.trim(),
    printer_name: configFields.printer_name.value.trim(),
    source_section_prefix: configFields.source_section_prefix.value.trim(),
    two_column_offset_dots: Number(configFields.two_column_offset_dots.value || 0),
    label_width_dots: Number(configFields.label_width_dots.value || 0),
    label_height_dots: Number(configFields.label_height_dots.value || 0),
  };

  setSettingsStatus("Salvando configuracao...");
  try {
    const response = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "Falha ao salvar configuracao.");
    }

    fillSettingsForm(data.config);
    setSettingsStatus("Configuracao salva com sucesso.", "success");
    await loadItems();
  } catch (error) {
    setSettingsStatus(error.message, "error");
  }
}

async function resetConfig() {
  if (!window.confirm("Restaurar os caminhos padrao?")) {
    return;
  }

  setSettingsStatus("Restaurando configuracao...");
  try {
    const response = await fetch("/api/config/reset", { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "Falha ao restaurar configuracao.");
    }

    fillSettingsForm(data.config);
    setSettingsStatus("Configuracao restaurada.", "success");
    await loadItems();
  } catch (error) {
    setSettingsStatus(error.message, "error");
  }
}

manualForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await printItem(manualCode.value.trim(), manualQuantity, manualForm.querySelector("button[type='submit']"));
});

manualSearchButton.addEventListener("click", searchManualCode);
refreshButton.addEventListener("click", loadItems);
printAllButton.addEventListener("click", printAllItems);
menuButton.addEventListener("click", () => toggleMobileMenu());
themeButton.addEventListener("click", toggleTheme);
labelConfigButton.addEventListener("click", openLabelConfigPage);
settingsButton.addEventListener("click", async () => {
  openSettings();
  if (!currentConfig) {
    await loadConfig();
  }
});
mobileThemeButton.addEventListener("click", () => {
  toggleTheme();
  toggleMobileMenu(false);
});
mobileLabelConfigButton.addEventListener("click", () => {
  toggleMobileMenu(false);
  openLabelConfigPage();
});
mobileSettingsButton.addEventListener("click", async () => {
  toggleMobileMenu(false);
  openSettings();
  if (!currentConfig) {
    await loadConfig();
  }
});
mobileRefreshButton.addEventListener("click", async () => {
  toggleMobileMenu(false);
  await loadItems();
});
closeSettingsButton.addEventListener("click", closeSettings);
cancelSettingsButton.addEventListener("click", closeSettings);
settingsBackdrop.addEventListener("click", closeSettings);
settingsForm.addEventListener("submit", saveConfig);
resetSettingsButton.addEventListener("click", resetConfig);
document.addEventListener("click", (event) => {
  if (!mobileMenu || mobileMenu.hidden || !menuButton) {
    return;
  }

  if (menuButton.contains(event.target) || mobileMenu.contains(event.target)) {
    return;
  }

  toggleMobileMenu(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !settingsModal.hidden) {
    closeSettings();
  }
  if (event.key === "Escape" && mobileMenu && !mobileMenu.hidden) {
    toggleMobileMenu(false);
  }
});

window.addEventListener("resize", () => {
  if (!isMobileLayout()) {
    toggleMobileMenu(false);
  }
});

applyTheme(getTheme());
toggleMobileMenu(false);
loadConfig().finally(loadItems);
