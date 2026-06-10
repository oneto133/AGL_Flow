import json
import os
import sys
from pathlib import Path


def get_app_home():
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


APP_HOME = get_app_home()
CONFIG_DIR = APP_HOME / "config"
CONFIG_PATH = CONFIG_DIR / "app_config.json"

DEFAULT_CONFIG = {
    "data_root": str(APP_HOME),
    "reposicao_csv": "csv/Reposicao e Diversos.csv",
    "labels_dir": "etiquetas",
    "report_dir": "relatorio",
    "base_file": "relatorio/base.xlsx",
    "printer_name": os.getenv("ZEBRA_PRINTER_NAME", "").strip(),
    "active_label_profile": "40x25",
    "label_profiles": {
        "100x80": {
            "name": "100 mm x 80 mm",
            "width_mm": 100,
            "height_mm": 80,
            "columns": 1,
            "gap_mm": 3,
            "left_x_mm": 3,
            "left_y_mm": 3,
            "right_x_mm": 53,
            "right_y_mm": 3,
            "printer_name": "",
        },
        "50x25": {
            "name": "50 mm x 25 mm",
            "width_mm": 50,
            "height_mm": 25,
            "columns": 2,
            "gap_mm": 3,
            "left_x_mm": 3,
            "left_y_mm": 2,
            "right_x_mm": 56,
            "right_y_mm": 2,
            "printer_name": "",
        },
        "40x25": {
            "name": "40 mm x 25 mm",
            "width_mm": 40,
            "height_mm": 25,
            "columns": 2,
            "gap_mm": 3,
            "left_x_mm": 3,
            "left_y_mm": 2,
            "right_x_mm": 46,
            "right_y_mm": 2,
            "printer_name": "",
        },
    },
    "two_column_offset_dots": int(os.getenv("ZEBRA_TWO_COLUMN_OFFSET_DOTS", "330")),
    "label_width_dots": int(os.getenv("ZEBRA_LABEL_WIDTH_DOTS", "330")),
    "label_height_dots": int(os.getenv("ZEBRA_LABEL_HEIGHT_DOTS", "200")),
    "source_section_prefix": "reposicaoediversos",
}


def load_config():
    config = DEFAULT_CONFIG.copy()
    if CONFIG_PATH.is_file():
        try:
            loaded = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                config.update(loaded)
        except (OSError, ValueError, json.JSONDecodeError):
            pass
    return config


def save_config(config):
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(
        json.dumps(config, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def resolve_path(value, base_dir=None):
    if value in (None, ""):
        return None

    path = Path(str(value).strip())
    if path.is_absolute():
        return path

    return (base_dir or APP_HOME) / path


def normalize_path_for_storage(value, base_dir=None):
    if value in (None, ""):
        return ""

    path = Path(str(value).strip())
    if path.is_absolute():
        return str(path)

    if base_dir is None:
        return str(path)

    return str(path)
