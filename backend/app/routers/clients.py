from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..auth import get_current_user
from ..database import get_db
from ..models import Client, Notification, Piece, Quote, QuoteVersion, Template, User

router = APIRouter(prefix="/api/clients", tags=["clients"])


class ClientCreate(BaseModel):
    company_name: str
    address: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    phone: Optional[str] = None
    siret: Optional[str] = None
    payment_terms: Optional[str] = "30 jours net"
    default_discount: Optional[float] = 0
    target_margin: Optional[float] = 30


class ClientOut(ClientCreate):
    id: int
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("", response_model=List[dict])
def list_clients(search: Optional[str] = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    q = db.query(Client)
    if search:
        q = q.filter(Client.company_name.ilike(f"%{search}%"))
    clients = q.order_by(Client.company_name).all()
    return [
        {
            "id": c.id,
            "company_name": c.company_name,
            "address": c.address,
            "contact_name": c.contact_name,
            "contact_email": c.contact_email,
            "phone": c.phone,
            "siret": c.siret,
            "payment_terms": c.payment_terms,
            "default_discount": float(c.default_discount or 0),
            "target_margin": float(c.target_margin or 30),
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in clients
    ]


@router.get("/{client_id}", response_model=dict)
def get_client(client_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c:
        raise HTTPException(404, "Client introuvable")
    return {
        "id": c.id,
        "company_name": c.company_name,
        "address": c.address,
        "contact_name": c.contact_name,
        "contact_email": c.contact_email,
        "phone": c.phone,
        "siret": c.siret,
        "payment_terms": c.payment_terms,
        "default_discount": float(c.default_discount or 0),
        "target_margin": float(c.target_margin or 30),
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.post("", response_model=dict, status_code=201)
def create_client(body: ClientCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    client = Client(**body.model_dump(), created_by=user.id)
    db.add(client)
    db.commit()
    db.refresh(client)
    return {"id": client.id, "company_name": client.company_name}


@router.put("/{client_id}", response_model=dict)
def update_client(client_id: int, body: ClientCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c:
        raise HTTPException(404, "Client introuvable")
    for k, v in body.model_dump().items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return {"id": c.id, "company_name": c.company_name}


@router.delete("/{client_id}", status_code=204)
def delete_client(client_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Supprime un client et cascade : devis liés, versions, notifications, pièces (trous/plis), et délie les templates."""
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c:
        raise HTTPException(404, "Client introuvable")

    quote_ids = [q.id for q in db.query(Quote.id).filter(Quote.client_id == client_id).all()]
    if quote_ids:
        db.query(Notification).filter(Notification.quote_id.in_(quote_ids)).delete(synchronize_session=False)
        db.query(QuoteVersion).filter(QuoteVersion.quote_id.in_(quote_ids)).delete(synchronize_session=False)
        for p in db.query(Piece).filter(Piece.quote_id.in_(quote_ids)).all():
            db.delete(p)
        db.query(Quote).filter(Quote.id.in_(quote_ids)).delete(synchronize_session=False)

    for p in db.query(Piece).filter(Piece.client_id == client_id).all():
        db.delete(p)

    db.query(Template).filter(Template.client_id == client_id).update({Template.client_id: None}, synchronize_session=False)

    db.delete(c)
    db.commit()
