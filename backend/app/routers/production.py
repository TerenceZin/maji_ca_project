from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..auth import get_current_user
from ..database import get_db
from ..models import Machine, Operation, ProductionQueue, User
from ..services.production import calculate_production_line

router = APIRouter(prefix="/api/production", tags=["production"])


@router.get("/operations")
def list_operations(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    ops = db.query(Operation).order_by(Operation.name).all()
    return [
        {
            "id": o.id,
            "name": o.name,
            "operation_type": o.operation_type,
            "unit_of_measure": o.unit_of_measure,
            "base_time_min": float(o.base_time_min),
            "setup_time_min": float(o.setup_time_min or 0),
        }
        for o in ops
    ]


@router.get("/machines")
def list_machines(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    machines = db.query(Machine).order_by(Machine.name).all()
    return [
        {
            "id": m.id,
            "name": m.name,
            "machine_type": m.machine_type,
            "operation_type": m.operation_type,
            "hourly_cost": float(m.hourly_cost),
            "status": m.status,
        }
        for m in machines
    ]


@router.get("/queue")
def get_queue(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    items = db.query(ProductionQueue).filter(
        ProductionQueue.status.in_(["en_cours", "en_attente"])
    ).all()
    return [
        {
            "id": q.id,
            "command_reference": q.command_reference,
            "machine_id": q.machine_id,
            "estimated_time_min": float(q.estimated_time_min or 0),
            "remaining_time_min": float(q.remaining_time_min or 0),
            "status": q.status,
            "scheduled_start": q.scheduled_start.isoformat() if q.scheduled_start else None,
        }
        for q in items
    ]


class CalculateRequest(BaseModel):
    operation_type: str
    quantity: float
    material: str
    thickness_mm: float
    complexity_factor: float = 1.0


@router.post("/calculate")
def calculate(body: CalculateRequest, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return calculate_production_line(
        db,
        body.operation_type,
        body.quantity,
        body.material,
        body.thickness_mm,
        body.complexity_factor,
    )
