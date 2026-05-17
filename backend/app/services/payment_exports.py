from __future__ import annotations

import html
import io
import os
import textwrap
import zipfile
from datetime import date, datetime
from decimal import Decimal
from xml.sax.saxutils import escape

from app.models.enums import PaymentDirection


EXPORT_COLUMNS = [
    ("booking_date", "Дата"),
    ("company_name", "Компания"),
    ("related_company_name", "Связанная компания"),
    ("bank_name", "Банк"),
    ("counterparty_name", "Контрагент"),
    ("signed_amount", "Сумма"),
    ("currency_code", "Валюта"),
    ("own_expense_amount_eur", "Свои расходы EUR"),
    ("vat_amount_eur", "Налог EUR"),
    ("company_commission_amount_eur", "Доходы/Расходы EUR"),
    ("client_name", "Клиент"),
    ("notes", "Комментарий"),
    ("status", "Статус"),
]


def prepare_payment_export_rows(rows: list[dict]) -> list[dict]:
    prepared = []
    for row in rows:
        signed_amount = row["amount_original"]
        if row["payment_direction"] == PaymentDirection.OUTGOING:
            signed_amount = Decimal("-1") * row["amount_original"]

        prepared.append(
            {
                **row,
                "signed_amount": signed_amount,
                "notes": row["notes"] or row["payment_purpose"],
                "status": str(row["status"]).replace("_", " "),
            }
        )
    return prepared


def build_payments_xlsx(rows: list[dict]) -> bytes:
    output = io.BytesIO()
    sheet_xml = _build_sheet_xml(rows)

    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", _content_types_xml())
        archive.writestr("_rels/.rels", _root_rels_xml())
        archive.writestr("xl/workbook.xml", _workbook_xml())
        archive.writestr("xl/_rels/workbook.xml.rels", _workbook_rels_xml())
        archive.writestr("xl/styles.xml", _styles_xml())
        archive.writestr("xl/worksheets/sheet1.xml", sheet_xml)

    return output.getvalue()


def build_payments_pdf(rows: list[dict], *, title: str, subtitle: str) -> bytes:
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import mm
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    except ImportError as exc:
        raise RuntimeError("PDF export dependency is not installed") from exc

    font_name = _register_pdf_font(pdfmetrics, TTFont)
    styles = getSampleStyleSheet()
    styles["Title"].fontName = font_name
    styles["Normal"].fontName = font_name

    buffer = io.BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=10 * mm,
        rightMargin=10 * mm,
        topMargin=10 * mm,
        bottomMargin=10 * mm,
        title=title,
    )

    table_data = [[label for _, label in EXPORT_COLUMNS]]
    for row in rows:
        table_data.append([_pdf_cell(_format_export_value(row.get(key))) for key, _ in EXPORT_COLUMNS])

    story = [
        Paragraph(html.escape(title), styles["Title"]),
        Paragraph(html.escape(subtitle), styles["Normal"]),
        Spacer(1, 5 * mm),
        Table(table_data, repeatRows=1, colWidths=[18 * mm, 25 * mm, 24 * mm, 18 * mm, 25 * mm, 20 * mm, 12 * mm, 18 * mm, 16 * mm, 20 * mm, 22 * mm, 33 * mm, 18 * mm]),
    ]
    story[-1].setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), font_name),
                ("FONTSIZE", (0, 0), (-1, -1), 6),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#edf2ff")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#14213d")),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#d7deee")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ]
        )
    )

    document.build(story)
    return buffer.getvalue()


def payment_export_filename(extension: str) -> str:
    return f"payments_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.{extension}"


def describe_export_period(date_from: date | None, date_to: date | None) -> str:
    start = date_from.isoformat() if date_from else "..."
    end = date_to.isoformat() if date_to else "..."
    return f"Период: {start} - {end}"


def _build_sheet_xml(rows: list[dict]) -> str:
    widths = [14, 28, 28, 20, 28, 15, 11, 17, 15, 20, 24, 34, 18]
    columns = "".join(f'<col min="{index}" max="{index}" width="{width}" customWidth="1"/>' for index, width in enumerate(widths, 1))
    sheet_rows = [_sheet_row(1, [label for _, label in EXPORT_COLUMNS], style=1)]

    for row_index, row in enumerate(rows, 2):
        sheet_rows.append(_sheet_row(row_index, [_format_export_value(row.get(key)) for key, _ in EXPORT_COLUMNS]))

    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f"<cols>{columns}</cols>"
        f"<sheetData>{''.join(sheet_rows)}</sheetData>"
        "</worksheet>"
    )


def _sheet_row(index: int, values: list[str], style: int | None = None) -> str:
    cells = []
    for column_index, value in enumerate(values, 1):
        reference = f"{_column_letter(column_index)}{index}"
        style_attr = f' s="{style}"' if style else ""
        cells.append(f'<c r="{reference}" t="inlineStr"{style_attr}><is><t>{escape(value)}</t></is></c>')
    return f'<row r="{index}">{"".join(cells)}</row>'


def _format_export_value(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, Decimal):
        return f"{value:.2f}"
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


def _pdf_cell(value: str) -> str:
    wrapped = "<br/>".join(textwrap.wrap(value, width=24, break_long_words=True)) if value else ""
    return wrapped


def _register_pdf_font(pdfmetrics, ttfont_class) -> str:
    font_path = "/usr/share/fonts/liberation-fonts/LiberationSans-Regular.ttf"
    font_name = "LiberationSans"
    if os.path.exists(font_path):
        pdfmetrics.registerFont(ttfont_class(font_name, font_path))
        return font_name
    return "Helvetica"


def _column_letter(index: int) -> str:
    letters = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        letters = chr(65 + remainder) + letters
    return letters


def _content_types_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        "</Types>"
    )


def _root_rels_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        "</Relationships>"
    )


def _workbook_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheets><sheet name="Платежи" sheetId="1" r:id="rId1"/></sheets>'
        "</workbook>"
    )


def _workbook_rels_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        "</Relationships>"
    )


def _styles_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
        '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>'
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/></cellXfs>'
        "</styleSheet>"
    )
