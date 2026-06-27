from schemas import SequenciarLinha
import csv

def sequenciar(linha: SequenciarLinha):
    with open("dados/csv/sequenciamento.csv", "a", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=SequenciarLinha.model_fields.keys()
        )

        writer.writerow(linha.model_dump(mode="json"))