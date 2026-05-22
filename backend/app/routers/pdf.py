"""PDF generation for quotes using ReportLab."""
import io
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (Image as RLImage, Paragraph, SimpleDocTemplate,
                                 Spacer, Table, TableStyle)

from ..auth import get_current_user
from ..database import get_db
from ..models import PlanFile, Quote, User

router = APIRouter(prefix="/api/pdf", tags=["pdf"])

MAJI_BLUE = colors.HexColor("#1a3a5c")
MAJI_ACCENT = colors.HexColor("#2563eb")


def build_quote_pdf_bytes(q: Quote, db: Session) -> bytes:
    """Generate PDF bytes for a quote — reusable outside the HTTP route."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )
    styles = getSampleStyleSheet()
    story = []

    # Header
    header_data = [
        [
            Paragraph(f"<b><font color='#{MAJI_BLUE.hexval()[2:]}' size=18>MAJI</font></b><br/><font size=9>Tôlerie fine industrielle</font>", styles["Normal"]),
            Paragraph(
                f"<b>DEVIS N° {q.reference}</b><br/>Date : {date.today().strftime('%d/%m/%Y')}<br/>Statut : {q.status.upper()}",
                ParagraphStyle("right", parent=styles["Normal"], alignment=2),
            ),
        ]
    ]
    header_table = Table(header_data, colWidths=[90 * mm, 90 * mm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, 0), 1, MAJI_BLUE),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 10 * mm))

    # Client block
    client_name = q.client.company_name if q.client else "—"
    client_address = q.client.address if q.client else ""
    story.append(Paragraph(f"<b>Client :</b> {client_name}", styles["Normal"]))
    if client_address:
        story.append(Paragraph(client_address, styles["Normal"]))
    story.append(Spacer(1, 8 * mm))

    data = q.data or {}

    # Quantité de série
    qty_serie = data.get("quantity_serie") or 1
    if qty_serie and qty_serie > 1:
        story.append(Paragraph(f"<b>Quantité de série :</b> {qty_serie} pièce(s)", styles["Normal"]))
        story.append(Spacer(1, 4 * mm))

    # Plan de la pièce (image uniquement — PDF non embarquable directement)
    piece_data = data.get("piece") or {}
    plan_file_id = piece_data.get("plan_file_id")
    if plan_file_id:
        plan_file = db.get(PlanFile, plan_file_id)
        if plan_file and plan_file.mime_type.startswith("image/"):
            story.append(Paragraph("<b>Plan de la pièce</b>", styles["Heading2"]))
            try:
                from PIL import Image as PILImage
                pil_img = PILImage.open(io.BytesIO(bytes(plan_file.data)))
                orig_w, orig_h = pil_img.size
                max_w, max_h = 160 * mm, 110 * mm
                ratio = min(max_w / orig_w, max_h / orig_h)
                img_w, img_h = orig_w * ratio, orig_h * ratio
            except Exception:
                img_w, img_h = 160 * mm, 110 * mm
            img_stream = io.BytesIO(bytes(plan_file.data))
            rl_img = RLImage(img_stream, width=img_w, height=img_h)
            rl_img.hAlign = "CENTER"
            story.append(rl_img)
            story.append(Spacer(1, 5 * mm))
        elif plan_file and plan_file.mime_type == "application/pdf":
            story.append(Paragraph("<b>Plan de la pièce</b>", styles["Heading2"]))
            try:
                import pypdfium2 as pdfium
                pdf_doc = pdfium.PdfDocument(bytes(plan_file.data))
                page = pdf_doc[0]
                bitmap = page.render(scale=3.0)
                pil_img = bitmap.to_pil()
                orig_w, orig_h = pil_img.size
                max_w, max_h = 160 * mm, 110 * mm
                ratio = min(max_w / orig_w, max_h / orig_h)
                img_buf = io.BytesIO()
                pil_img.save(img_buf, format="PNG")
                img_buf.seek(0)
                rl_img = RLImage(img_buf, width=orig_w * ratio, height=orig_h * ratio)
                rl_img.hAlign = "CENTER"
                story.append(rl_img)
            except Exception:
                story.append(Paragraph("<b>Plan de la pièce :</b> plan PDF joint (voir annexe)", styles["Normal"]))
            story.append(Spacer(1, 5 * mm))

    # ── Dimensions & Masse ──────────────────────────────────────────────────────
    if piece_data:
        story.append(Paragraph("<b>■ Dimensions &amp; Masse</b>", styles["Heading2"]))
        dims_rows = []
        def _dim(label, value, unit=""):
            if value is not None:
                dims_rows.append([label, f"{value} {unit}".strip()])

        _dim("Longueur",          piece_data.get("longueur_mm"),       "mm")
        _dim("Largeur",           piece_data.get("largeur_mm"),         "mm")
        _dim("Hauteur",           piece_data.get("hauteur_mm"),         "mm")
        _dim("Épaisseur",         piece_data.get("epaisseur_mm"),       "mm")
        _dim("Longueur découpe",  piece_data.get("longueur_decoupe_mm"), "mm")

        surf = piece_data.get("surface_dev_m2")
        if surf is not None:
            dims_rows.append(["Surface dév.", f"{float(surf):.6g} m²"])

        vol = piece_data.get("volume_mm3")
        if vol is not None:
            dims_rows.append(["Volume", f"{float(vol):.2f} mm³"])

        masse = piece_data.get("masse_g")
        if masse is not None:
            masse_f = float(masse)
            dims_rows.append(["Masse estimée unitaire", f"{masse_f:.1f} g  ({masse_f/1000:.3f} kg)"])
            if qty_serie and qty_serie > 1:
                masse_tot = masse_f * qty_serie
                dims_rows.append(["Masse estimée totale", f"{masse_tot:.1f} g  ({masse_tot/1000:.3f} kg)"])

        if dims_rows:
            dt = Table(dims_rows, colWidths=[55 * mm, 120 * mm])
            dt.setStyle(TableStyle([
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#d1d5db")),
                ("PADDING", (0, 0), (-1, -1), 4),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]))
            story.append(dt)
            story.append(Spacer(1, 5 * mm))

    # ── Notes & Tolérances ──────────────────────────────────────────────────────
    tolerances = piece_data.get("tolerances") if piece_data else None
    notes_text = piece_data.get("notes") if piece_data else None
    if tolerances or notes_text:
        story.append(Paragraph("<b>■ Notes &amp; Tolérances</b>", styles["Heading2"]))
        notes_rows = []
        if tolerances:
            notes_rows.append(["Tolérances", tolerances])
        if notes_text:
            notes_rows.append(["Notes libres", Paragraph(notes_text, styles["Normal"])])
        nt = Table(notes_rows, colWidths=[55 * mm, 120 * mm])
        nt.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#d1d5db")),
            ("PADDING", (0, 0), (-1, -1), 4),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        story.append(nt)
        story.append(Spacer(1, 5 * mm))

    # Components table
    components = data.get("components", [])
    if components:
        story.append(Paragraph("<b>Composants et matières premières</b>", styles["Heading2"]))
        rows = [["Référence", "Désignation", "Fournisseur", "Qté", "P.U. HT", "Total HT"]]
        for c in components:
            rows.append([
                c.get("reference", ""),
                Paragraph(c.get("name", ""), styles["Normal"]),
                c.get("supplier", ""),
                str(c.get("quantity", 1)),
                f"{float(c.get('unit_price', 0)):.2f}€",
                f"{float(c.get('total', 0)):.2f}€",
            ])
        t = Table(rows, colWidths=[25*mm, 60*mm, 30*mm, 15*mm, 20*mm, 20*mm])
        t.setStyle(_table_style())
        story.append(t)
        story.append(Spacer(1, 5 * mm))

    # Production table
    production = data.get("production", [])
    if production:
        story.append(Paragraph("<b>Production</b>", styles["Heading2"]))
        rows = [["Opération", "Machine", "Temps (min)", "Coût/h", "Total HT"]]
        for p in production:
            rows.append([
                p.get("operation_name", ""),
                p.get("machine_name", ""),
                str(p.get("time_min", 0)),
                f"{float(p.get('hourly_cost', 0)):.2f}€/h",
                f"{float(p.get('cost', 0)):.2f}€",
            ])
        t = Table(rows, colWidths=[50*mm, 40*mm, 25*mm, 25*mm, 30*mm])
        t.setStyle(_table_style())
        story.append(t)
        story.append(Spacer(1, 5 * mm))

    # Transport
    transport = data.get("transport", {})
    if transport:
        story.append(Paragraph("<b>Transport</b>", styles["Heading2"]))
        story.append(Paragraph(f"Mode : {transport.get('mode', '—')} — Coût : {float(transport.get('cost', 0)):.2f}€", styles["Normal"]))
        story.append(Spacer(1, 5 * mm))

    # Summary
    story.append(Spacer(1, 8 * mm))
    subtotal = float(data.get('subtotal', 0))
    margin_amount = float(data.get('margin_amount', 0))
    total_ht = subtotal + margin_amount if (subtotal or margin_amount) else float(q.total_ht)
    total_ttc = total_ht * 1.2
    summary_data = [
        ["Sous-total HT", f"{subtotal:.2f}€"],
        [f"Marge ({q.margin_percent}%)", f"{margin_amount:.2f}€"],
        ["Total HT", f"{total_ht:.2f}€"],
        ["TVA (20%)", f"{total_ht * 0.20:.2f}€"],
        ["Total TTC", f"{total_ttc:.2f}€"],
    ]
    st = Table(summary_data, colWidths=[130 * mm, 40 * mm])
    st.setStyle(TableStyle([
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, -1), (-1, -1), 11),
        ("BACKGROUND", (0, -1), (-1, -1), MAJI_ACCENT),
        ("TEXTCOLOR", (0, -1), (-1, -1), colors.white),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LINEABOVE", (0, -1), (-1, -1), 1, MAJI_BLUE),
        ("ROWBACKGROUNDS", (0, 0), (-1, -2), [colors.white, colors.HexColor("#f0f4ff")]),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(st)

    # Footer
    story.append(Spacer(1, 15 * mm))
    story.append(Paragraph(
        "<font size=8 color='#888888'>Ce devis est valable 30 jours à compter de sa date d'émission. "
        "MAJI SAS — SIRET 123 456 789 00010 — TVA FR 12 345678900</font>",
        styles["Normal"],
    ))

    doc.build(story)
    buf.seek(0)
    return buf.read()


@router.get("/{quote_id}")
def generate_pdf(quote_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    q = db.query(Quote).filter(Quote.id == quote_id).first()
    if not q:
        raise HTTPException(404, "Devis introuvable")
    pdf_bytes = build_quote_pdf_bytes(q, db)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=devis-{q.reference}.pdf"},
    )


def _table_style():
    return TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), MAJI_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#d1d5db")),
        ("PADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ])
