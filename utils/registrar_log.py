from datetime import datetime
import json, logging
from config.paths import JSON_DIR

logger = logging.getLogger("JsonLogger")
logger.setLevel(logging.INFO)



arquivo_log = logging.FileHandler(JSON_DIR / "log.json")

class JsonFormatter(logging.Formatter):

    def format(self, record):

        dados_do_log = {
            "timestamp": datetime.fromtimestamp(record.created).isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "filename": record.pathname,
            "line_number": record.lineno,
        }

        if hasattr(record, "extra_data"):
            dados_do_log["context"] = record.extra_data

        return json.dumps(dados_do_log)

if not logger.handlers:
    formatter = JsonFormatter()

    arquivo_log.setFormatter(formatter)

    logger.addHandler(arquivo_log)