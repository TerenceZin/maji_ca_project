"""Mock endpoints fournisseurs — simulent les APIs Bossard et ArcelorMittal."""
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import CatalogItem, User

router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])


@router.get("/bossard/products")
def bossard_products(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(CatalogItem).filter(CatalogItem.supplier == "Bossard")
    if search:
        q = q.filter(
            (CatalogItem.name.ilike(f"%{search}%")) | (CatalogItem.reference.ilike(f"%{search}%"))
        )
    return [
        {
            "ref": c.reference,
            "name": c.name,
            "category": c.category,
            "supplier": c.supplier,
            "unit_price": float(c.unit_price),
            "unit": c.unit,
            "weight_g": float(c.weight_g) if c.weight_g else None,
            "moq": c.moq,
        }
        for c in q.all()
    ]


@router.get("/arcelormittal/products")
def arcelormittal_products(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(CatalogItem).filter(CatalogItem.supplier == "ArcelorMittal")
    if search:
        q = q.filter(
            (CatalogItem.name.ilike(f"%{search}%")) | (CatalogItem.reference.ilike(f"%{search}%"))
        )
    return [
        {
            "ref": c.reference,
            "name": c.name,
            "category": c.category,
            "supplier": c.supplier,
            "unit_price": float(c.unit_price),
            "unit": c.unit,
            "weight_g": float(c.weight_g) if c.weight_g else None,
            "thickness_mm": float(c.thickness_mm) if c.thickness_mm else None,
            "moq": c.moq,
        }
        for c in q.all()
    ]
