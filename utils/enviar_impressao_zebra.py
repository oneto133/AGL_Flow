import ctypes, re

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