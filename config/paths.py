from pathlib import Path
from dotenv import load_dotenv
import os

load_dotenv()

APP_HOME = Path(__file__).resolve().parent.parent

TEMPLATES_DIR = APP_HOME / "templates"
DADOS_DIR = APP_HOME / "dados"

CSV_DIR = DADOS_DIR / "csv"
JSON_DIR = DADOS_DIR / "json"

TRELLO_KEY = os.getenv("TRELLO_API_KEY")
TRELLO_TOKEN = os.getenv("TRELLO_TOKEN")