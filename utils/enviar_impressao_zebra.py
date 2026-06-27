import ctypes, re
from pathlib import Path
from datetime import datetime
from .normalizar import *

def send_raw_to_printer(printer_name, data, job_name):
    """
    envia a eetiqueta direto para a impressora selecionada sem gerar imagem
    passa direto pelo hardware
    """
    winspool = ctypes.WinDLL("winspool.drv")
    printer_handle = ctypes.wintypes.HANDLE()

    if not winspool.OpenPrinterW(printer_name, ctypes.byref(printer_handle), None):
        raise ctypes.WinError()

    class DOC_INFO_1(ctypes.Structure):
        _fields_ = [
            ("pDocName", ctypes.wintypes.LPWSTR),
            ("pOutputFile", ctypes.wintypes.LPWSTR),
            ("pDatatype", ctypes.wintypes.LPWSTR),
        ]

    doc_info = DOC_INFO_1(job_name, None, "RAW")
    written = ctypes.wintypes.DWORD(0)

    try:
        if not winspool.StartDocPrinterW(printer_handle, 1, ctypes.byref(doc_info)):
            raise ctypes.WinError()
        try:
            if not winspool.StartPagePrinter(printer_handle):
                raise ctypes.WinError()
            buffer = ctypes.create_string_buffer(data)
            if not winspool.WritePrinter(printer_handle, buffer, len(data), ctypes.byref(written)):
                raise ctypes.WinError()
            winspool.EndPagePrinter(printer_handle)
        finally:
            winspool.EndDocPrinter(printer_handle)
    finally:
        winspool.ClosePrinter(printer_handle)


def get_default_printer_name():
    """
    Pega a impressora padrão e retorna para o usuário
    """
    winspool = ctypes.WinDLL("winspool.drv")
    needed = ctypes.wintypes.DWORD(0)
    winspool.GetDefaultPrinterW(None, ctypes.byref(needed))

    if needed.value == 0:
        raise RuntimeError("Nenhuma impressora padrao encontrada.")

    buffer = ctypes.create_unicode_buffer(needed.value)
    if not winspool.GetDefaultPrinterW(buffer, ctypes.byref(needed)):
        raise ctypes.WinError()

    return buffer.value

def _find_draw_start(data):
    "identifica onde inicia os elementos da etiqueta para inserir os dados no local correto"

    positions = [position for position in (data.find(b"^FO"), data.find(b"^FT"), data.find(b"^BY")) if position >= 0]
    return min(positions) if positions else None

def _last_pq_match(data):
    matches = list(re.finditer(rb"\^PQ\d+(,\d+,\d+,[YN])?", data))
    return matches[-1] if matches else None

def _last_zpl_label_match(data):
    matches = list(re.finditer(rb"\^XA.*?\^XZ", data, flags=re.DOTALL))
    return matches[-1] if matches else None

def _shift_zpl_position(data, x_offset=0, y_offset=0):
    data = re.sub(
        rb"\^FO(\d+),(\d+)",
        lambda match: f"^FO{int(match.group(1)) + x_offset},{int(match.group(2)) + y_offset}".encode("ascii"),
        data,
    )
    data = re.sub(
        rb"\^FT(\d+),(\d+)",
        lambda match: f"^FT{int(match.group(1)) + x_offset},{int(match.group(2)) + y_offset}".encode("ascii"),
        data,
    )
    return data

def prepare_raw_label(data, quantidade):
    if b"^PQ" in data:
        match = _last_pq_match(data)
        if match:
            replacement = f"^PQ{quantidade},0,1,Y".encode("ascii")
            return data[: match.start()] + replacement + data[match.end() :]

    if b"^XZ" in data:
        last_xz = data.rfind(b"^XZ")
        return data[:last_xz] + f"^PQ{quantidade},0,1,Y\r\n".encode("ascii") + data[last_xz:]

    return data

def ensure_parent_dirs(paths):
    paths["report_dir"].mkdir(parents=True, exist_ok=True)
    paths["labels_dir"].mkdir(parents=True, exist_ok=True)
    paths["reposicao_csv"].parent.mkdir(parents=True, exist_ok=True)
    paths["base_file"].parent.mkdir(parents=True, exist_ok=True)


def _find_matching_code(values, labels_dir):
    label_codes = {path.stem for path in labels_dir.glob("*") if path.is_file()}
    for value in values:
        cleaned = Path(str(value).strip()).stem
        if cleaned in label_codes:
            return cleaned
    return ""

def build_label_column(item, position, config):
    x_offset = int(position.get("x", 0))
    y_offset = int(position.get("y", 0))

    description, description_font, description_width = _build_description_layout(item.get("nome") or "")
    code = zpl_text(item.get("codigo") or "")
    barcode = only_digits(item.get("codigo_barras") or "")
    current_date = datetime.now().strftime("%d/%m/%Y %H:%M")

    commands = [

        f"""
            ^FO{x_offset + 22},{y_offset + 28}
            ^A0N,{description_font},{description_font}
            ^FB{description_width},3,1,L,0
            ^FD{description}^FS
            """.strip(),

        # =========================
        # CÓDIGO
        # =========================
        f"""
            ^FO{x_offset + 22},{y_offset + 96}
            ^A0N,22,22
            ^FD{code}^FS
            """.strip(),

        # =========================
        # DATA
        # =========================
        f"""
            ^FO{x_offset + 165},{y_offset + 96}
            ^A0N,16,16
            ^FD{current_date}^FS
            """.strip(),
                ]

    if barcode:

        commands.extend([

            # =========================
            # CÓDIGO DE BARRAS
            # =========================
            f"""
            ^BY2,2,52
            ^FT{x_offset + 58},{y_offset + 178}
            ^BEN,52,Y,N
            ^FD{barcode}^FS
            """.strip()

                    ])

    else:

        commands.append(

            f"""
                ^FO{x_offset + 22},{y_offset + 145}
                ^A0N,20,20
                ^FDEAN NAO ENCONTRADO^FS
                """.strip()

                        )

    return commands


def _build_description_layout(value):
    description = re.sub(r"\s+", " ", zpl_text(value or "")).strip()
    length = len(description)
    estimated_lines = min(3, max(1, (length + 27) // 28))

    if estimated_lines >= 3:
        font_size = 18
        box_width = 232
    elif estimated_lines == 2:
        font_size = 20
        box_width = 242
    else:
        font_size = 22
        box_width = 250

    return description, font_size, box_width