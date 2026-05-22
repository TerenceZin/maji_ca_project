from typing import List, Optional
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..auth import get_current_user, require_director
from ..config import settings
from ..database import get_db
from ..models import Notification, Quote, QuoteVersion, User

router = APIRouter(prefix="/api/quotes", tags=["quotes"])


def _next_ref(db: Session) -> str:
    """Génère la prochaine référence de devis au format DEV-ANNÉE-XXXX."""
    count = db.query(Quote).count() + 1
    return f"DEV-{datetime.now().year}-{count:04d}"


def quote_to_dict(q: Quote) -> dict:
    """Sérialise un objet Quote en dict JSON-compatible pour les réponses API."""
    return {
        "id": q.id,
        "reference": q.reference,
        "client_id": q.client_id,
        "client_name": q.client.company_name if q.client else None,
        "status": q.status,
        "data": q.data,
        "margin_percent": float(q.margin_percent or 30),
        "total_ht": float(q.total_ht or 0),
        "total_ttc": float(q.total_ttc or 0),
        "estimated_delivery_date": q.estimated_delivery_date.isoformat() if q.estimated_delivery_date else None,
        "validation_comment": q.validation_comment,
        "created_by": q.created_by,
        "validated_by": q.validated_by,
        "created_at": q.created_at.isoformat() if q.created_at else None,
        "updated_at": q.updated_at.isoformat() if q.updated_at else None,
    }


class QuoteCreate(BaseModel):
    client_id: Optional[int] = None
    data: dict = {}
    margin_percent: float = 30
    total_ht: float = 0
    total_ttc: float = 0
    estimated_delivery_date: Optional[str] = None


class QuoteUpdate(QuoteCreate):
    status: Optional[str] = None
    validation_comment: Optional[str] = None


@router.get("", response_model=List[dict])
def list_quotes(
    status: Optional[str] = None,
    client_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Liste tous les devis, filtrables par statut et/ou client, triés par date de modification décroissante."""
    q = db.query(Quote)
    if status:
        q = q.filter(Quote.status == status)
    if client_id:
        q = q.filter(Quote.client_id == client_id)
    quotes = q.order_by(Quote.updated_at.desc()).all()
    return [quote_to_dict(qt) for qt in quotes]


@router.get("/stats")
def get_stats(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Retourne le nombre de devis par statut et le nombre d'alertes de changement de prix catalogue."""
    statuses = ["draft", "submitted", "validated", "sent", "accepted", "refused", "refused_client"]
    result = {}
    for s in statuses:
        result[s] = db.query(Quote).filter(Quote.status == s).count()
    # Price alerts
    from ..models import CatalogItem
    alerts = db.query(CatalogItem).filter(CatalogItem.price_change_flag == True).count()
    result["price_alerts"] = alerts
    return result


@router.get("/{quote_id}", response_model=dict)
def get_quote(quote_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Retourne le détail d'un devis par son identifiant (404 si introuvable)."""
    q = db.query(Quote).filter(Quote.id == quote_id).first()
    if not q:
        raise HTTPException(404, "Devis introuvable")
    return quote_to_dict(q)


@router.post("", status_code=201, response_model=dict)
def create_quote(body: QuoteCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Crée un nouveau devis en statut 'draft' avec une référence auto-générée et sauvegarde la version initiale."""
    delivery = None
    if body.estimated_delivery_date:
        delivery = date.fromisoformat(body.estimated_delivery_date)
    q = Quote(
        reference=_next_ref(db),
        client_id=body.client_id,
        data=body.data,
        margin_percent=body.margin_percent,
        total_ht=body.total_ht,
        total_ttc=body.total_ttc,
        estimated_delivery_date=delivery,
        created_by=user.id,
        status="draft",
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    # Save version
    _save_version(db, q)
    return quote_to_dict(q)


@router.put("/{quote_id}", response_model=dict)
def update_quote(quote_id: int, body: QuoteUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Met à jour les données d'un devis existant et crée un instantané de version."""
    q = db.query(Quote).filter(Quote.id == quote_id).first()
    if not q:
        raise HTTPException(404, "Devis introuvable")
    q.client_id = body.client_id if body.client_id is not None else q.client_id
    q.data = body.data
    q.margin_percent = body.margin_percent
    q.total_ht = body.total_ht
    q.total_ttc = body.total_ttc
    if body.estimated_delivery_date:
        q.estimated_delivery_date = date.fromisoformat(body.estimated_delivery_date)
    if body.status:
        q.status = body.status
    if body.validation_comment is not None:
        q.validation_comment = body.validation_comment
    q.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(q)
    _save_version(db, q)
    return quote_to_dict(q)


@router.post("/{quote_id}/submit")
def submit_quote(quote_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """
    Soumet un devis : si le montant HT dépasse le seuil de validation, passe en 'submitted'
    et notifie les directeurs ; sinon passe directement en 'sent'.
    """
    q = db.query(Quote).filter(Quote.id == quote_id).first()
    if not q:
        raise HTTPException(404, "Devis introuvable")
    if float(q.total_ht or 0) > settings.validation_threshold:
        q.status = "submitted"
        # Notify directors
        directors = db.query(User).filter(User.role == "directeur").all()
        for d in directors:
            notif = Notification(
                user_id=d.id,
                title=f"Devis {q.reference} en attente de validation",
                body=f"Montant : {q.total_ht:.2f}€ HT — Client : {q.client.company_name if q.client else 'N/A'}",
                quote_id=q.id,
            )
            db.add(notif)
    else:
        q.status = "sent"
    q.updated_at = datetime.utcnow()
    db.commit()
    return {"status": q.status}


@router.post("/{quote_id}/validate")
def validate_quote(
    quote_id: int,
    comment: Optional[str] = None,
    action: str = "approve",
    db: Session = Depends(get_db),
    user: User = Depends(require_director),
):
    """
    Permet au directeur d'approuver, refuser ou renvoyer en brouillon un devis soumis.
    Notifie le créateur du devis du résultat de la décision.
    """
    q = db.query(Quote).filter(Quote.id == quote_id).first()
    if not q:
        raise HTTPException(404, "Devis introuvable")
    if action == "approve":
        q.status = "validated"
    elif action == "refuse":
        q.status = "refused"
    elif action == "request_modification":
        q.status = "draft"
    q.validation_comment = comment
    q.validated_by = user.id
    q.updated_at = datetime.utcnow()
    # Notify creator
    notif = Notification(
        user_id=q.created_by,
        title=f"Devis {q.reference} — {action}",
        body=comment or "",
        quote_id=q.id,
    )
    db.add(notif)
    db.commit()
    return {"status": q.status}


@router.delete("/{quote_id}", status_code=204)
def delete_quote(quote_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Supprime un devis et toutes ses versions (uniquement si statut 'draft' ou 'submitted')."""
    q = db.query(Quote).filter(Quote.id == quote_id).first()
    if not q:
        raise HTTPException(404, "Devis introuvable")
    if q.status not in ("draft", "submitted"):
        raise HTTPException(400, "Seuls les devis brouillon ou en attente peuvent être supprimés")
    db.query(QuoteVersion).filter(QuoteVersion.quote_id == quote_id).delete()
    db.delete(q)
    db.commit()


class SendEmailRequest(BaseModel):
    email: str
    message: str = ""


@router.post("/{quote_id}/send-email")
def send_quote_email(
    quote_id: int,
    body: SendEmailRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Génère le PDF du devis et l'envoie par email au destinataire indiqué, puis passe le statut à 'sent'."""
    q = db.query(Quote).filter(Quote.id == quote_id).first()
    if not q:
        raise HTTPException(404, "Devis introuvable")

    from ..routers.pdf import build_quote_pdf_bytes
    try:
        pdf_bytes = build_quote_pdf_bytes(q, db)
    except Exception as exc:
        raise HTTPException(500, f"Erreur génération PDF : {exc}")

    from ..email_service import send_quote_email as _send
    try:
        _send(q, body.email, body.message, pdf_bytes)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc))
    except Exception as exc:
        raise HTTPException(500, f"Erreur envoi email : {exc}")

    q.status = "sent"
    q.updated_at = datetime.utcnow()
    db.commit()
    return {"status": "sent", "sent_to": body.email}


@router.get("/{quote_id}/versions")
def get_versions(quote_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Retourne l'historique des versions d'un devis, triées de la plus récente à la plus ancienne."""
    versions = db.query(QuoteVersion).filter(QuoteVersion.quote_id == quote_id).order_by(QuoteVersion.version_number.desc()).all()
    return [{"id": v.id, "version_number": v.version_number, "created_at": v.created_at.isoformat()} for v in versions]


def _save_version(db: Session, q: Quote):
    """Crée un instantané immutable du devis dans QuoteVersion avec un numéro de version incrémental."""
    last = db.query(QuoteVersion).filter(QuoteVersion.quote_id == q.id).order_by(QuoteVersion.version_number.desc()).first()
    version_number = (last.version_number + 1) if last else 1
    v = QuoteVersion(quote_id=q.id, version_number=version_number, data=q.data)
    db.add(v)
    db.commit()
