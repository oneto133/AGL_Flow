import subprocess
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
LABELS_DIR = BASE_DIR / "etiquetas"
ZEBRA_DESIGNER = Path(r"C:\Program Files (x86)\Zebra Technologies\ZebraDesigner 2\bin\Design.exe")


def build_job(label_path, prn_path, job_path):
    lines = [
        f'LABEL "{label_path}"',
        f'PORT "{prn_path}"',
        "PRINT 1",
        "QUIT",
    ]
    job_path.write_text("\n".join(lines), encoding="utf-8")


def main():
    if not ZEBRA_DESIGNER.exists():
        raise SystemExit(f"ZebraDesigner nao encontrado: {ZEBRA_DESIGNER}")

    labels = sorted(LABELS_DIR.glob("*.lbl"))
    if not labels:
        print("Nenhum arquivo .lbl encontrado em etiquetas.")
        return

    for label_path in labels:
        prn_path = label_path.with_suffix(".prn")
        job_path = BASE_DIR / f"gerar_prn_{label_path.stem}.job"

        build_job(label_path, prn_path, job_path)
        subprocess.run([str(ZEBRA_DESIGNER), str(job_path)], check=True, timeout=60)
        print(f"Gerado: {prn_path}")


if __name__ == "__main__":
    main()
