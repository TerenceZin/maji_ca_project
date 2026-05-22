"""Email sending service using smtplib (stdlib — no extra dependency)."""
import io
import smtplib
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from .config import settings


def send_quote_email(quote, to_email: str, message: str, pdf_bytes: bytes) -> None:
    if not settings.smtp_host:
        raise RuntimeError(
            "SMTP non configuré. Ajoutez SMTP_HOST / SMTP_USER / SMTP_PASSWORD dans votre .env."
        )

    msg = MIMEMultipart()
    msg["From"] = settings.smtp_from
    msg["To"] = to_email
    msg["Subject"] = f"Devis {quote.reference} — Maji Tôlerie Fine"

    client_name = quote.client.company_name if quote.client else "votre entreprise"
    custom_block = (
        f"<blockquote style='border-left:3px solid #2563eb;padding:8px 16px;"
        f"color:#555;margin:16px 0'>{message}</blockquote>"
        if message.strip()
        else ""
    )

    html = f"""<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;color:#1f2937;max-width:600px;margin:auto;padding:24px">
  <div style="border-bottom:3px solid #1a3a5c;padding-bottom:16px;margin-bottom:24px">
    <span style="font-size:22px;font-weight:bold;color:#1a3a5c">MAJI</span>
    <span style="font-size:13px;color:#6b7280;margin-left:8px">Tôlerie fine industrielle</span>
  </div>
  <p>Bonjour,</p>
  <p>Veuillez trouver ci-joint le devis <strong>{quote.reference}</strong> établi pour <strong>{client_name}</strong>.</p>
  {custom_block}
  <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px">
    <tr style="background:#f0f4ff">
      <td style="padding:10px;border:1px solid #d1d5db"><strong>Référence</strong></td>
      <td style="padding:10px;border:1px solid #d1d5db">{quote.reference}</td>
    </tr>
    <tr>
      <td style="padding:10px;border:1px solid #d1d5db"><strong>Montant HT</strong></td>
      <td style="padding:10px;border:1px solid #d1d5db">{float(quote.total_ht or 0):.2f} €</td>
    </tr>
    <tr style="background:#f0f4ff">
      <td style="padding:10px;border:1px solid #d1d5db"><strong>Montant TTC</strong></td>
      <td style="padding:10px;border:1px solid #d1d5db"><strong>{float(quote.total_ttc or 0):.2f} €</strong></td>
    </tr>
  </table>
  <p style="font-size:13px;color:#6b7280">
    Ce devis est valable 30 jours à compter de sa date d'émission.<br>
    Le détail complet est disponible dans le PDF joint à cet email.
  </p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="font-size:12px;color:#9ca3af">
    MAJI SAS — SIRET 123 456 789 00010 — TVA FR 12 345678900<br>
    Cet email a été envoyé automatiquement depuis le système de devis Maji.
  </p>
</body>
</html>"""

    msg.attach(MIMEText(html, "html", "utf-8"))

    part = MIMEBase("application", "octet-stream")
    part.set_payload(pdf_bytes)
    encoders.encode_base64(part)
    part.add_header(
        "Content-Disposition",
        f'attachment; filename="devis-{quote.reference}.pdf"',
    )
    msg.attach(part)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.ehlo()
        if settings.smtp_tls:
            server.starttls()
            server.ehlo()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)
