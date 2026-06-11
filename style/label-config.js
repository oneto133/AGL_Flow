const THEME_STORAGE_KEY = "nova-pasta-theme";
const PROFILE_ORDER = ["100x80", "50x25", "40x25"];

if (!localStorage.getItem("etiquetas-auth")) {
  window.location.replace("/");
}

const themeButton = document.querySelector("#themeButton");
const backButton = document.querySelector("#backButton");
const saveButton = document.querySelector("#saveLabelConfigButton");
const resetButton = document.querySelector("#resetLabelConfigButton");
const refreshPrintersButton = document.querySelector("#refreshPrintersButton");
const saveConfirmOverlay = document.querySelector("#saveConfirmOverlay");
const cancelSaveButton = document.querySelector("#cancelSaveButton");
const confirmSaveButton = document.querySelector("#confirmSaveButton");
const profileTabs = document.querySelector("#profileTabs");
const profileDescription = document.querySelector("#profileDescription");
const profileMeta = document.querySelector("#profileMeta");
const labelPreview = document.querySelector("#labelPreview");
const previewLeft = document.querySelector("#previewLeft");
const previewRight = document.querySelector("#previewRight");
const profileSummary = document.querySelector("#profileSummary");
const layoutNote = document.querySelector("#layoutNote");
const statusMessage = document.querySelector("#labelConfigStatus");

const fields = {
  columns: document.querySelector("#profileColumns"),
  gapMm: document.querySelector("#profileGapMm"),
  dpi: document.querySelector("#profileDpi"),
  printerName: document.querySelector("#profilePrinterName"),
  widthMm: document.querySelector("#profileWidthMm"),
  heightMm: document.querySelector("#profileHeightMm"),
  widthDots: document.querySelector("#profileWidthDots"),
  heightDots: document.querySelector("#profileHeightDots"),
  leftXMm: document.querySelector("#profileLeftXMm"),
  leftYMm: document.querySelector("#profileLeftYMm"),
  rightXMm: document.querySelector("#profileRightXMm"),
  rightYMm: document.querySelector("#profileRightYMm"),
};

const state = {
  activeProfileId: "",
  dpi: 203,
  printers: [],
  defaultPrinter: "",
  profiles: {},
};

function getTheme() {
  return localStorage.getItem(THEME_STORAGE_KEY) || "dark";
}

function applyTheme(theme) {
  const activeTheme = theme === "day" ? "day" : "dark";
  document.body.dataset.theme = activeTheme;
  localStorage.setItem(THEME_STORAGE_KEY, activeTheme);
  if (themeButton) {
    themeButton.textContent = activeTheme === "day" ? "Dia" : "Noite";
  }
}

function mmToDots(value) {
  return Math.round((Number(value) || 0) * state.dpi / 25.4);
}

function dotsToMm(value) {
  return Math.round((Number(value) || 0) * 25.4 / state.dpi * 10) / 10;
}

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = `label-config-status ${type}`.trim();
}

function openSaveConfirmation() {
  if (!saveConfirmOverlay) {
    saveConfig();
    return;
  }

  saveConfirmOverlay.hidden = false;
}

function closeSaveConfirmation() {
  if (saveConfirmOverlay) {
    saveConfirmOverlay.hidden = true;
  }
}

function getActiveProfile() {
  return state.profiles[state.activeProfileId] || null;
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeProfile(profileId, profile) {
  const columns = safeNumber(profile.columns, 1) >= 2 ? 2 : 1;
  return {
    id: profileId,
    name: profile.name || profileId,
    width_mm: safeNumber(profile.width_mm, 0),
    height_mm: safeNumber(profile.height_mm, 0),
    columns,
    gap_mm: safeNumber(profile.gap_mm, 0),
    printer_name: profile.printer_name || "",
    left_x_mm: safeNumber(profile.left_x_mm, 0),
    left_y_mm: safeNumber(profile.left_y_mm, 0),
    right_x_mm: safeNumber(profile.right_x_mm, 0),
    right_y_mm: safeNumber(profile.right_y_mm, 0),
  };
}

function getPreviewBounds(profile) {
  const sheets = [
    { x: profile.left_x_mm, y: profile.left_y_mm },
  ];

  if (profile.columns > 1) {
    sheets.push({ x: profile.right_x_mm, y: profile.right_y_mm });
  }

  const minX = Math.min(0, ...sheets.map((sheet) => sheet.x));
  const minY = Math.min(0, ...sheets.map((sheet) => sheet.y));
  const maxX = Math.max(...sheets.map((sheet) => sheet.x + profile.width_mm));
  const maxY = Math.max(...sheets.map((sheet) => sheet.y + profile.height_mm));

  return {
    minX,
    minY,
    maxX,
    maxY,
    canvasWidthMm: Math.max(1, maxX - minX),
    canvasHeightMm: Math.max(1, maxY - minY),
  };
}

function renderPrinterSelect(profile) {
  const select = fields.printerName;
  if (!select) {
    return;
  }

  const currentValue = profile.printer_name || "";
  const printers = Array.isArray(state.printers) ? state.printers : [];
  const options = [];

  options.push({ value: "", label: "Padrão do dispositivo" });
  for (const printer of printers) {
    options.push({ value: printer, label: printer });
  }

  if (currentValue && !options.some((option) => option.value === currentValue)) {
    options.push({ value: currentValue, label: `${currentValue} (salva)` });
  }

  select.innerHTML = "";
  for (const option of options) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    select.append(element);
  }

  select.value = currentValue || "";
}

function updateProfileField(profileId, field, value) {
  const profile = state.profiles[profileId];
  if (!profile) {
    return;
  }

  profile[field] = value;
  renderCurrentProfile();
}

function renderTabs() {
  profileTabs.innerHTML = "";

  for (const profileId of PROFILE_ORDER) {
    const profile = state.profiles[profileId];
    if (!profile) {
      continue;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = `label-config-tab ${profileId === state.activeProfileId ? "is-active" : ""}`.trim();
    button.dataset.profileId = profileId;
    button.innerHTML = `<strong>${profile.name}</strong><span>${profile.width_mm} mm x ${profile.height_mm} mm</span>`;
    button.addEventListener("click", () => {
      state.activeProfileId = profileId;
      renderTabs();
      renderCurrentProfile();
    });
    profileTabs.append(button);
  }
}

function renderSummary(profile, canvasWidthMm, canvasHeightMm) {
  profileSummary.innerHTML = "";

  const items = [
    { label: "Área total", value: `${canvasWidthMm.toFixed(1)} x ${canvasHeightMm.toFixed(1)} mm` },
    { label: "Offset esquerdo", value: `${profile.left_x_mm.toFixed(1)} x ${profile.left_y_mm.toFixed(1)} mm` },
    { label: "Offset direito", value: profile.columns > 1 ? `${profile.right_x_mm.toFixed(1)} x ${profile.right_y_mm.toFixed(1)} mm` : "Desativado" },
    { label: "Gap", value: `${profile.gap_mm.toFixed(1)} mm` },
  ];

  for (const item of items) {
    const chip = document.createElement("div");
    chip.className = "label-meta-chip";
    chip.innerHTML = `<span>${item.label}</span><strong>${item.value}</strong>`;
    profileSummary.append(chip);
  }
}

function renderMeta(profile, canvasWidthMm, canvasHeightMm) {
  profileMeta.innerHTML = "";

  const items = [
    { label: "Formato", value: profile.name },
    { label: "Colunas", value: `${profile.columns}` },
    { label: "Impressora", value: profile.printer_name || "Impressora padrão" },
    { label: "Área", value: `${canvasWidthMm.toFixed(1)} x ${canvasHeightMm.toFixed(1)} mm` },
  ];

  for (const item of items) {
    const chip = document.createElement("div");
    chip.className = "label-meta-chip";
    chip.innerHTML = `<span>${item.label}</span><strong>${item.value}</strong>`;
    profileMeta.append(chip);
  }
}

function renderPreview(profile) {
  const bounds = getPreviewBounds(profile);
  const { minX, minY, canvasWidthMm, canvasHeightMm } = bounds;

  labelPreview.style.aspectRatio = `${canvasWidthMm} / ${canvasHeightMm}`;

  const leftWidth = (profile.width_mm / canvasWidthMm) * 100;
  const leftHeight = (profile.height_mm / canvasHeightMm) * 100;
  previewLeft.hidden = false;
  previewLeft.style.left = `${((profile.left_x_mm - minX) / canvasWidthMm) * 100}%`;
  previewLeft.style.top = `${((profile.left_y_mm - minY) / canvasHeightMm) * 100}%`;
  previewLeft.style.width = `${leftWidth}%`;
  previewLeft.style.height = `${leftHeight}%`;
  previewLeft.querySelector(".label-sheet__title").textContent = `Esquerda - ${profile.width_mm} x ${profile.height_mm} mm`;
  previewLeft.querySelector(".label-sheet__sub").textContent = `${profile.left_x_mm.toFixed(1)} x ${profile.left_y_mm.toFixed(1)} mm`;

  previewRight.hidden = profile.columns < 2;
  if (profile.columns > 1) {
    previewRight.style.left = `${((profile.right_x_mm - minX) / canvasWidthMm) * 100}%`;
    previewRight.style.top = `${((profile.right_y_mm - minY) / canvasHeightMm) * 100}%`;
    previewRight.style.width = `${leftWidth}%`;
    previewRight.style.height = `${leftHeight}%`;
    previewRight.querySelector(".label-sheet__title").textContent = `Direita - ${profile.width_mm} x ${profile.height_mm} mm`;
    previewRight.querySelector(".label-sheet__sub").textContent = `${profile.right_x_mm.toFixed(1)} x ${profile.right_y_mm.toFixed(1)} mm`;
  }

  const dotSummary = `Largura: ${mmToDots(profile.width_mm)} dots | Altura: ${mmToDots(profile.height_mm)} dots`;
  profileDescription.textContent = `${profile.name} com ${profile.columns} coluna(s). ${dotSummary}. Impressora: ${profile.printer_name || "padrão"}.`;
  layoutNote.textContent = profile.columns > 1
    ? `A coluna direita começa em ${profile.right_x_mm.toFixed(1)} mm no eixo X. O gap atual é de ${profile.gap_mm.toFixed(1)} mm.`
    : "Este formato está em 1 coluna. A area da direita fica desativada ate voce mudar para 2 colunas.";

  renderMeta(profile, canvasWidthMm, canvasHeightMm);
  renderSummary(profile, canvasWidthMm, canvasHeightMm);
}

function fillForm(profile) {
  fields.columns.value = String(profile.columns);
  fields.gapMm.value = profile.gap_mm.toFixed(1);
  fields.dpi.value = String(state.dpi);
  fields.widthMm.value = profile.width_mm.toFixed(1);
  fields.heightMm.value = profile.height_mm.toFixed(1);
  fields.widthDots.value = String(mmToDots(profile.width_mm));
  fields.heightDots.value = String(mmToDots(profile.height_mm));
  fields.leftXMm.value = profile.left_x_mm.toFixed(1);
  fields.leftYMm.value = profile.left_y_mm.toFixed(1);
  fields.rightXMm.value = profile.right_x_mm.toFixed(1);
  fields.rightYMm.value = profile.right_y_mm.toFixed(1);
  renderPrinterSelect(profile);

  const rightDisabled = profile.columns < 2;
  fields.rightXMm.disabled = rightDisabled;
  fields.rightYMm.disabled = rightDisabled;
}

function renderCurrentProfile() {
  const profile = getActiveProfile();
  if (!profile) {
    return;
  }

  fillForm(profile);
  renderPreview(profile);
}

function readFormIntoState() {
  const profile = getActiveProfile();
  if (!profile) {
    return;
  }

  profile.columns = Number(fields.columns.value) >= 2 ? 2 : 1;
  profile.gap_mm = safeNumber(fields.gapMm.value, profile.gap_mm);
  profile.printer_name = fields.printerName.value.trim();
  profile.left_x_mm = safeNumber(fields.leftXMm.value, profile.left_x_mm);
  profile.left_y_mm = safeNumber(fields.leftYMm.value, profile.left_y_mm);
  if (profile.columns > 1) {
    profile.right_x_mm = safeNumber(fields.rightXMm.value, profile.right_x_mm);
    profile.right_y_mm = safeNumber(fields.rightYMm.value, profile.right_y_mm);
  }
}

function serializeProfilesForSave() {
  const payload = {};
  for (const [profileId, profile] of Object.entries(state.profiles)) {
    payload[profileId] = {
      name: profile.name,
      width_mm: safeNumber(profile.width_mm, 0),
      height_mm: safeNumber(profile.height_mm, 0),
      columns: profile.columns,
      gap_mm: safeNumber(profile.gap_mm, 0),
      printer_name: profile.printer_name || "",
      left_x_mm: safeNumber(profile.left_x_mm, 0),
      left_y_mm: safeNumber(profile.left_y_mm, 0),
      right_x_mm: safeNumber(profile.right_x_mm, 0),
      right_y_mm: safeNumber(profile.right_y_mm, 0),
    };
  }
  return payload;
}

async function loadConfig() {
  setStatus("Carregando perfis de etiqueta...");

  try {
    const response = await fetch("/api/label-config");
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "Nao foi possivel carregar a configuracao.");
    }

    state.dpi = Number(data.config.dpi || 203);
    state.activeProfileId = data.config.active_profile || PROFILE_ORDER[0];
    state.profiles = {};

    for (const profileId of PROFILE_ORDER) {
      if (data.config.profiles?.[profileId]) {
        state.profiles[profileId] = normalizeProfile(profileId, data.config.profiles[profileId]);
      }
    }

    await loadPrinters(true);
    renderTabs();
    renderCurrentProfile();
    setStatus("");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function loadPrinters(silent = false) {
  try {
    const response = await fetch("/api/printers");
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || data.error || "Nao foi possivel listar as impressoras.");
    }

    state.printers = Array.isArray(data.printers) ? data.printers : [];
    state.defaultPrinter = data.default_printer || "";

    const profile = getActiveProfile();
    if (profile) {
      renderPrinterSelect(profile);
    }

    return data;
  } catch (error) {
    state.printers = [];
    state.defaultPrinter = "";
    const profile = getActiveProfile();
    if (profile) {
      renderPrinterSelect(profile);
    }
    if (!silent) {
      setStatus(error.message, "error");
    }
    return { printers: [], default_printer: "" };
  }
}

async function saveConfig() {
  readFormIntoState();

  const payload = {
    active_profile: state.activeProfileId,
    profiles: serializeProfilesForSave(),
  };

  setStatus("Salvando configuração de etiquetas...");
  saveButton.disabled = true;

  try {
    const response = await fetch("/api/label-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "Falha ao salvar a configuração.");
    }

    state.activeProfileId = data.config.active_profile || PROFILE_ORDER[0];
    state.dpi = Number(data.config.dpi || state.dpi);
    for (const profileId of PROFILE_ORDER) {
      if (data.config.profiles?.[profileId]) {
        state.profiles[profileId] = normalizeProfile(profileId, data.config.profiles[profileId]);
      }
    }
    renderTabs();
    renderCurrentProfile();
    setStatus("Configuração de etiquetas salva com sucesso.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    saveButton.disabled = false;
    if (confirmSaveButton) {
      confirmSaveButton.disabled = false;
    }
    closeSaveConfirmation();
  }
}

async function resetConfig() {
  if (!window.confirm("Restaurar os perfis de etiqueta para o padrão?")) {
    return;
  }

  setStatus("Restaurando configuração...");
  resetButton.disabled = true;

  try {
    const response = await fetch("/api/label-config/reset", { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "Falha ao restaurar a configuração.");
    }

    state.dpi = Number(data.config.dpi || 203);
    state.activeProfileId = data.config.active_profile;
    state.profiles = {};
    for (const profileId of PROFILE_ORDER) {
      if (data.config.profiles?.[profileId]) {
        state.profiles[profileId] = normalizeProfile(profileId, data.config.profiles[profileId]);
      }
    }
    renderTabs();
    renderCurrentProfile();
    setStatus("Configuração restaurada.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    resetButton.disabled = false;
  }
}

function bindFormEvents() {
  const syncAndRender = () => {
    readFormIntoState();
    renderCurrentProfile();
  };

  fields.columns.addEventListener("change", syncAndRender);
  fields.gapMm.addEventListener("input", syncAndRender);
  fields.printerName.addEventListener("change", syncAndRender);
  fields.leftXMm.addEventListener("input", syncAndRender);
  fields.leftYMm.addEventListener("input", syncAndRender);
  fields.rightXMm.addEventListener("input", syncAndRender);
  fields.rightYMm.addEventListener("input", syncAndRender);

  if (refreshPrintersButton) {
    refreshPrintersButton.addEventListener("click", () => loadPrinters());
  }
}

themeButton.addEventListener("click", () => {
  applyTheme(getTheme() === "day" ? "dark" : "day");
});

backButton.addEventListener("click", () => {
  window.location.href = "/";
});

saveButton.addEventListener("click", openSaveConfirmation);
resetButton.addEventListener("click", resetConfig);
bindFormEvents();
applyTheme(getTheme());
loadConfig();

if (cancelSaveButton) {
  cancelSaveButton.addEventListener("click", closeSaveConfirmation);
}

if (confirmSaveButton) {
  confirmSaveButton.addEventListener("click", async () => {
    confirmSaveButton.disabled = true;
    try {
      await saveConfig();
    } finally {
      confirmSaveButton.disabled = false;
    }
  });
}

if (saveConfirmOverlay) {
  saveConfirmOverlay.addEventListener("click", (event) => {
    if (event.target === saveConfirmOverlay) {
      closeSaveConfirmation();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && saveConfirmOverlay && !saveConfirmOverlay.hidden) {
    closeSaveConfirmation();
  }
});
