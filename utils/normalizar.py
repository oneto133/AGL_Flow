import re, unicodedata

def value_to_text(value):
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()

def only_digits(value):
    return re.sub(r"\D", "", value or "")


def zpl_text(value):
    text = strip_accents(value).upper()
    return text.replace("\\", " ").replace("^", " ").replace("~", " ")

def strip_accents(value):
    normalized = unicodedata.normalize("NFKD", value or "")
    return "".join(char for char in normalized if not unicodedata.combining(char))