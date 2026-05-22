from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_director
from ..database import get_db
from ..models import ProductTemplate, User

router = APIRouter(prefix="/api/product-templates", tags=["product-templates"])


class ProductTemplateCreate(BaseModel):
    reference: str
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    components_data: list = []
    production_data: list = []
    dimensions_colis: str = ""
    poids_emballage_g: int = 0


class ProductTemplateResponse(BaseModel):
    id: int
    reference: str
    name: str
    description: Optional[str]
    category: Optional[str]
    components_data: list
    production_data: list
    dimensions_colis: str
    poids_emballage_g: int

    class Config:
        from_attributes = True


@router.get("", response_model=List[ProductTemplateResponse])
def list_product_templates(
    q: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(ProductTemplate)
    if q and len(q) >= 2:
        pattern = f"%{q}%"
        query = query.filter(
            func.unaccent(ProductTemplate.name).ilike(func.unaccent(pattern))
            | ProductTemplate.reference.ilike(pattern)
            | func.unaccent(ProductTemplate.description).ilike(func.unaccent(pattern))
            | func.unaccent(ProductTemplate.category).ilike(func.unaccent(pattern))
        )
    return query.order_by(ProductTemplate.name).limit(20).all()


@router.get("/{template_id}", response_model=ProductTemplateResponse)
def get_product_template(template_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    pt = db.query(ProductTemplate).filter(ProductTemplate.id == template_id).first()
    if not pt:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    return pt


@router.post("", response_model=ProductTemplateResponse)
def create_product_template(body: ProductTemplateCreate, db: Session = Depends(get_db), _: User = Depends(require_director)):
    pt = ProductTemplate(**body.dict())
    db.add(pt)
    db.commit()
    db.refresh(pt)
    return pt


@router.put("/{template_id}", response_model=ProductTemplateResponse)
def update_product_template(template_id: int, body: ProductTemplateCreate, db: Session = Depends(get_db), _: User = Depends(require_director)):
    pt = db.query(ProductTemplate).filter(ProductTemplate.id == template_id).first()
    if not pt:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    for k, v in body.dict().items():
        setattr(pt, k, v)
    db.commit()
    db.refresh(pt)
    return pt


@router.delete("/{template_id}")
def delete_product_template(template_id: int, db: Session = Depends(get_db), _: User = Depends(require_director)):
    pt = db.query(ProductTemplate).filter(ProductTemplate.id == template_id).first()
    if not pt:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    db.delete(pt)
    db.commit()
    return {"ok": True}
