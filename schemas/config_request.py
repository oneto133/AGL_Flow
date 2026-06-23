from pydantic import BaseModel, Field

class ConfigRequest(BaseModel):
    data_root: str | None = None
    reposicao_csv: str | None = None
    labels_dir: str | None = None
    report_dir: str | None = None
    base_file: str | None = None
    printer_name: str | None = None
    two_column_offset_dots: int | None = Field(default=None, ge=0, le=4000)
    label_width_dots: int | None = Field(default=None, ge=1, le=4000)
    label_height_dots: int | None = Field(default=None, ge=1, le=4000)
    source_section_prefix: str | None = None