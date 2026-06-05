#!/usr/bin/env python3
import csv
import json
import math
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INPUT_XLSX = ROOT / "Campaña #EsMásQueUnPingüino (Respuestas).xlsx"
OUT_DIR = ROOT / "generated"
OUT_JSON = OUT_DIR / "google_form_import.json"
OUT_CSV = OUT_DIR / "google_form_import.csv"
OUT_ISSUES = OUT_DIR / "google_form_import_issues.json"
OUT_IMPORT_JSON = OUT_DIR / "google_form_import_ready.json"
OUT_IMPORT_CSV = OUT_DIR / "google_form_import_ready.csv"

NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip()


def normalize_text(value: str) -> str:
    return normalize_whitespace(value)


def normalize_rut(value: str) -> str:
    return normalize_text(value).replace(".", "").replace("-", "").upper()


def compute_rut_dv(body: str) -> str:
    total = 0
    multiplier = 2
    for ch in reversed(body):
        total += int(ch) * multiplier
        multiplier = 2 if multiplier == 7 else multiplier + 1
    remainder = 11 - (total % 11)
    return "0" if remainder == 11 else "K" if remainder == 10 else str(remainder)


def validate_rut(value: str) -> bool:
    clean = normalize_rut(value)
    if not re.fullmatch(r"\d{7,8}[0-9K]", clean):
        return False
    body = clean[:-1]
    dv = clean[-1]
    return dv == compute_rut_dv(body)


def format_rut(value: str) -> str:
    clean = normalize_rut(value)
    if len(clean) < 2:
        return clean
    body = clean[:-1]
    dv = clean[-1]
    chunks = []
    while body:
        chunks.insert(0, body[-3:])
        body = body[:-3]
    return f"{'.'.join(chunks)}-{dv}"


def rescue_rut(raw_value: str) -> tuple[str, bool, str | None]:
    raw = normalize_text(raw_value).upper()
    clean = normalize_rut(raw)

    if validate_rut(clean):
        return clean, True, None

    # Cases like "10 .362.414-2" or "22. 399. 050-9"
    compact = re.sub(r"[^0-9K]", "", raw)
    if validate_rut(compact):
        return compact, True, "removed_non_rut_chars"

    # Excel scientific notation corruption, recover numeric body and recompute DV.
    scientific_match = re.fullmatch(r"([0-9]+(?:\.[0-9]+)?)E-?([0-9]+)", raw.replace(" ", ""))
    if scientific_match:
        mantissa = scientific_match.group(1).replace(".", "")
        if len(mantissa) >= 7:
            body = mantissa[:8] if len(mantissa) >= 8 else mantissa
            dv = compute_rut_dv(body)
            candidate = f"{body}{dv}"
            if validate_rut(candidate):
                return candidate, True, "rescued_from_scientific_notation"

    # Numeric body without DV; recompute a valid one only when length suggests Chilean RUT.
    digits_only = re.sub(r"[^0-9]", "", raw)
    if len(digits_only) in (7, 8):
        candidate = f"{digits_only}{compute_rut_dv(digits_only)}"
        if validate_rut(candidate):
            return candidate, True, "recomputed_dv_from_digits_only"

    return clean, False, None


def split_full_name(full_name: str) -> tuple[str, str]:
    parts = [part for part in normalize_text(full_name).split(" ") if part]
    if not parts:
        return ("Firma", "Importada")
    if len(parts) == 1:
        return (parts[0].title(), "Importada")
    first = " ".join(parts[:-2] or parts[:1]).title()
    last = " ".join(parts[-2:] if len(parts) > 2 else parts[1:]).title()
    return (first, last)


def parse_excel_rows(path: Path) -> list[list[str]]:
    with zipfile.ZipFile(path) as zf:
        shared = []
        if "xl/sharedStrings.xml" in zf.namelist():
            root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for si in root.findall("a:si", NS):
                text = "".join(node.text or "" for node in si.findall(".//a:t", NS))
                shared.append(text)

        wb = ET.fromstring(zf.read("xl/workbook.xml"))
        rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
        relmap = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}
        first_sheet = wb.find("a:sheets/a:sheet", NS)
        target = relmap[first_sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]]
        if not target.startswith("xl/"):
            target = "xl/" + target
        sheet = ET.fromstring(zf.read(target))

        rows: list[list[str]] = []
        for row in sheet.findall("a:sheetData/a:row", NS):
            values = []
            for cell in row.findall("a:c", NS):
                cell_type = cell.attrib.get("t")
                value_node = cell.find("a:v", NS)
                if value_node is None:
                    values.append("")
                    continue
                raw = value_node.text or ""
                if cell_type == "s":
                    values.append(shared[int(raw)])
                else:
                    values.append(raw)
            rows.append(values)
        return rows


def synthetic_email(rut: str, row_number: int) -> str:
    clean = normalize_rut(rut)
    suffix = clean.lower() if clean else f"fila{row_number}"
    return f"noinformamail+{suffix}@gmail.com"


def normalize_country(value: str) -> str:
    normalized = normalize_text(value).lower()
    if normalized in {"", "chile", "chile."}:
        return "Chile"
    return normalize_text(value).title()


def parse_age(value: str) -> tuple[int, bool]:
    normalized = normalize_text(value).replace(",", ".")
    if not normalized:
      return 18, True
    try:
        number = float(normalized)
    except ValueError:
        return 18, True
    if not math.isfinite(number):
        return 18, True
    age = int(number)
    if age < 1 or age > 120:
        return 18, True
    return age, False


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rows = parse_excel_rows(INPUT_XLSX)
    header = rows[0]
    body = rows[1:]

    transformed = []
    issues = []

    for idx, row in enumerate(body, start=2):
        row = row + [""] * (len(header) - len(row))
        record = dict(zip(header, row))

        full_name = normalize_text(record.get("Nombre completo (como aparece en tu cédula de identidad o pasaporte o en tu certificado de vigencia)", ""))
        rut_raw = normalize_text(record.get("RUT (con puntos y guión)", ""))
        country = normalize_country(record.get("País", ""))
        age_raw = normalize_text(record.get("Edad (sólo números)", ""))
        legal_nature = normalize_text(record.get("¿Eres persona natural o jurídica?", ""))
        endorsement = normalize_text(record.get("Luego de leer la Carta abierta de la Comunidad Científica y conociendo la importancia del Pingüino de Humboldt en nuestro país", ""))

        first_name, last_name = split_full_name(full_name)
        rut_clean, valid_rut, rescue_note = rescue_rut(rut_raw)
        rut_formatted = format_rut(rut_clean)

        age, synthetic_age = parse_age(age_raw)

        item = {
            "sourceRow": idx,
            "sourceTimestamp": record.get("Marca temporal", ""),
            "sourceFullName": full_name,
            "sourceCountry": country,
            "sourceAge": age_raw,
            "sourceLegalNature": legal_nature or "No informado",
            "sourceEndorsement": endorsement,
            "firstName": first_name,
            "lastName": last_name,
            "rut": rut_formatted,
            "email": synthetic_email(rut_clean, idx),
            "age": age,
            "country": country or "Chile",
            "legalNature": legal_nature or "Persona natural",
            "region": "Pendiente",
            "commune": "Pendiente",
            "affiliation": legal_nature or "Importado desde Google Form",
            "message": "Firma importada desde Google Form histórico.",
            "consent": True,
            "updates": False,
            "importSource": "google_form",
            "syntheticFields": ["email", "region", "commune", "message"],
        }

        row_issues = []
        if not full_name:
            row_issues.append("missing_full_name")
        if not valid_rut:
            row_issues.append("invalid_rut")
        if country and country != "Chile":
            row_issues.append("non_chile_country")
        if synthetic_age:
            row_issues.append("synthetic_age")
            if "age" not in item["syntheticFields"]:
                item["syntheticFields"].append("age")
        if not country:
            if "country" not in item["syntheticFields"]:
                item["syntheticFields"].append("country")
        if not legal_nature:
            if "legalNature" not in item["syntheticFields"]:
                item["syntheticFields"].append("legalNature")

        if row_issues:
            issues.append(
                {
                    "sourceRow": idx,
                    "fullName": full_name,
                    "rutRaw": rut_raw,
                    "rutNormalized": rut_clean,
                    "rutRescueNote": rescue_note,
                    "issues": row_issues,
                }
            )

        item["validRut"] = valid_rut
        item["rutRescueNote"] = rescue_note
        transformed.append(item)

    with OUT_JSON.open("w", encoding="utf-8") as fh:
        json.dump(transformed, fh, ensure_ascii=False, indent=2)

    csv_fields = [
        "sourceRow",
        "sourceTimestamp",
        "sourceFullName",
        "sourceCountry",
        "sourceLegalNature",
        "firstName",
        "lastName",
        "rut",
        "email",
        "age",
        "country",
        "legalNature",
        "region",
        "commune",
        "affiliation",
        "message",
        "consent",
        "updates",
        "importSource",
        "validRut",
        "syntheticFields",
    ]
    with OUT_CSV.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=csv_fields)
        writer.writeheader()
        for item in transformed:
            row = {key: item.get(key, "") for key in csv_fields}
            row["syntheticFields"] = ",".join(item["syntheticFields"])
            writer.writerow(row)

    with OUT_ISSUES.open("w", encoding="utf-8") as fh:
        json.dump(issues, fh, ensure_ascii=False, indent=2)

    ready_rows = [
        {
            "firstName": item["firstName"],
            "lastName": item["lastName"],
            "rut": item["rut"],
            "email": item["email"],
            "age": item["age"],
            "country": item["country"],
            "legalNature": item["legalNature"],
            "region": item["region"],
            "commune": item["commune"],
            "affiliation": item["affiliation"],
            "message": item["message"],
            "consent": item["consent"],
            "updates": item["updates"],
        }
        for item in transformed
    ]

    with OUT_IMPORT_JSON.open("w", encoding="utf-8") as fh:
        json.dump(ready_rows, fh, ensure_ascii=False, indent=2)

    import_fields = [
        "firstName",
        "lastName",
        "rut",
        "email",
        "age",
        "country",
        "legalNature",
        "region",
        "commune",
        "affiliation",
        "message",
        "consent",
        "updates",
    ]
    with OUT_IMPORT_CSV.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=import_fields)
        writer.writeheader()
        for item in ready_rows:
            writer.writerow(item)

    print(
        json.dumps(
            {
                "input": str(INPUT_XLSX.name),
                "rows": len(body),
                "output_json": str(OUT_JSON.relative_to(ROOT)),
                "output_csv": str(OUT_CSV.relative_to(ROOT)),
                "output_import_json": str(OUT_IMPORT_JSON.relative_to(ROOT)),
                "output_import_csv": str(OUT_IMPORT_CSV.relative_to(ROOT)),
                "issues_json": str(OUT_ISSUES.relative_to(ROOT)),
                "issue_count": len(issues),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
