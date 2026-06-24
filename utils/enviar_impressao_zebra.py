import ctypes

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