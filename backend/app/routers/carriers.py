from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_director
from ..database import get_db
from ..models import Carrier, User

router = APIRouter(prefix="/api/carriers", tags=["carriers"])


class CarrierCreate(BaseModel):
    name: str
    service_type: str
    tarif_kg: float
    tarif_palette: float
    delai_moyen_j: int
    zones_geo: str
    active: bool = True


class CarrierResponse(BaseModel):
    id: int
    name: str
    service_type: str
    tarif_kg: float
    tarif_palette: float
    delai_moyen_j: int
    zones_geo: str
    active: bool

    class Config:
        from_attributes = True


@router.get("", response_model=List[CarrierResponse])
def list_carriers(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Carrier).filter(Carrier.active == True).order_by(Carrier.name).all()


@router.get("/all", response_model=List[CarrierResponse])
def list_all_carriers(db: Session = Depends(get_db), _: User = Depends(require_director)):
    return db.query(Carrier).order_by(Carrier.name).all()


@router.post("", response_model=CarrierResponse)
def create_carrier(body: CarrierCreate, db: Session = Depends(get_db), _: User = Depends(require_director)):
    carrier = Carrier(**body.dict())
    db.add(carrier)
    db.commit()
    db.refresh(carrier)
    return carrier


@router.put("/{carrier_id}", response_model=CarrierResponse)
def update_carrier(carrier_id: int, body: CarrierCreate, db: Session = Depends(get_db), _: User = Depends(require_director)):
    carrier = db.query(Carrier).filter(Carrier.id == carrier_id).first()
    if not carrier:
        raise HTTPException(status_code=404, detail="Transporteur introuvable")
    for k, v in body.dict().items():
        setattr(carrier, k, v)
    db.commit()
    db.refresh(carrier)
    return carrier


@router.delete("/{carrier_id}")
def delete_carrier(carrier_id: int, db: Session = Depends(get_db), _: User = Depends(require_director)):
    carrier = db.query(Carrier).filter(Carrier.id == carrier_id).first()
    if not carrier:
        raise HTTPException(status_code=404, detail="Transporteur introuvable")
    carrier.active = False
    db.commit()
    return {"ok": True}
