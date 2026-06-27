import re

def value_to_text(value):
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()

def only_digits(value):
    return re.sub(r"\D", "", value or "")
