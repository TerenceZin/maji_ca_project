from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from ..auth import get_current_user
from ..database import get_db
from ..models import Template, User
from ..services.supplier_sync import refresh_prices

router = APIRouter(prefix="/api/templates", tags=["templates"])


class TemplateCreate(BaseModel):
    name: str
    type: str
    client_id: Optional[int] = None
    data: dict = {}


def template_to_dict(t: Template) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "type": t.type,
        "client_id": t.client_id,
        "client_name": t.client.company_name if t.client else None,
        "data": t.data,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "last_used_at": t.last_used_at.isoformat() if t.last_used_at else None,
        "usage_count": t.usage_count,
    }


@router.get("", response_model=List[dict])
def list_templates(
    type: Optional[str] = None,
    client_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Template)
    if type:
        q = q.filter(Template.type == type)
    if client_id:
        q = q.filter(Template.client_id == client_id)
    if search:
        q = q.filter(Template.name.ilike(f"%{search}%"))
    templates = q.order_by(Template.last_used_at.desc().nullslast()).all()
    return [template_to_dict(t) for t in templates]


@router.get("/{template_id}", response_model=dict)
def get_template(template_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    t = db.query(Template).filter(Template.id == template_id).first()
    if not t:
        raise HTTPException(404, "Template introuvable")
    # Refresh prices for all references in template
    data = t.data or {}
    refs = [line.get("reference") for line in data.get("components", []) if line.get("reference")]
    if refs:
        refresh_prices(db, refs)
    t.last_used_at = datetime.utcnow()
    t.usage_count = (t.usage_count or 0) + 1
    db.commit()
    return template_to_dict(t)


@router.post("", status_code=201, response_model=dict)
def create_template(body: TemplateCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = Template(name=body.name, type=body.type, client_id=body.client_id, data=body.data, created_by=user.id)
    db.add(t)
    db.commit()
    db.refresh(t)
    return template_to_dict(t)


@router.put("/{template_id}", response_model=dict)
def update_template(template_id: int, body: TemplateCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    t = db.query(Template).filter(Template.id == template_id).first()
    if not t:
        raise HTTPException(404, "Template introuvable")
    t.name = body.name
    t.type = body.type
    t.client_id = body.client_id
    t.data = body.data
    db.commit()
    db.refresh(t)
    return template_to_dict(t)


@router.delete("/{template_id}", status_code=204)
def delete_template(template_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    t = db.query(Template).filter(Template.id == template_id).first()
    if not t:
        raise HTTPException(404, "Template introuvable")
    db.delete(t)
    db.commit()
