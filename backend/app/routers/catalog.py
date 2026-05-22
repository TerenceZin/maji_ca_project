from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from ..auth import get_current_user
from ..database import get_db
from ..models import CatalogItem, CatalogRequest, User

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


def item_to_dict(c: CatalogItem) -> dict:
    return {
        "id": c.id,
        "reference": c.reference,
        "name": c.name,
        "category": c.category,
        "supplier": c.supplier,
        "unit_price": float(c.unit_price),
        "unit": c.unit,
        "weight_g": float(c.weight_g) if c.weight_g else None,
        "thickness_mm": float(c.thickness_mm) if c.thickness_mm else None,
        "moq": c.moq,
        "last_updated": c.last_updated.isoformat() if c.last_updated else None,
        "price_change_flag": c.price_change_flag,
        "price_change_percent": float(c.price_change_percent) if c.price_change_percent else 0,
        "previous_price": float(c.previous_price) if c.previous_price else None,
    }


@router.get("", response_model=List[dict])
def list_catalog(
    search: Optional[str] = None,
    category: Optional[str] = None,
    supplier: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(CatalogItem)
    if search:
        q = q.filter(
            (CatalogItem.name.ilike(f"%{search}%")) | (CatalogItem.reference.ilike(f"%{search}%"))
        )
    if category:
        q = q.filter(CatalogItem.category == category)
    if supplier:
        q = q.filter(CatalogItem.supplier == supplier)
    return [item_to_dict(c) for c in q.order_by(CatalogItem.supplier, CatalogItem.name).all()]


@router.get("/last-sync")
def last_sync(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    item = db.query(CatalogItem).order_by(CatalogItem.last_updated.desc()).first()
    return {"last_sync": item.last_updated.isoformat() if item else None}


@router.post("/refresh")
def refresh_catalog(
    references: Optional[List[str]] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from ..services.supplier_sync import refresh_prices
    updated = refresh_prices(db, references)
    return {"updated": updated, "synced_at": datetime.utcnow().isoformat()}


@router.get("/{reference}")
def get_by_reference(reference: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    item = db.query(CatalogItem).filter(CatalogItem.reference == reference).first()
    if not item:
        raise HTTPException(404, "Référence introuvable")
    return item_to_dict(item)


class CatalogRequestCreate(BaseModel):
    description: str
    supplier: Optional[str] = None


@router.post("/requests", status_code=201)
def create_request(body: CatalogRequestCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    req = CatalogRequest(requested_by=user.id, description=body.description, supplier=body.supplier)
    db.add(req)
    db.commit()
    db.refresh(req)
    return {"id": req.id, "status": req.status}


@router.get("/requests/list")
def list_requests(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    reqs = db.query(CatalogRequest).order_by(CatalogRequest.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "description": r.description,
            "supplier": r.supplier,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in reqs
    ]
