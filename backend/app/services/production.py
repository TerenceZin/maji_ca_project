"""
Calcul des temps et coûts de production à partir des barèmes BDD.
"""
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from ..models import Machine, Operation, ProductionQueue


THICKNESS_COEFF_MAP = {
    0.5: "coeff_ep_05",
    0.8: "coeff_ep_08",
    1.0: "coeff_ep_10",
    1.5: "coeff_ep_15",
    2.0: "coeff_ep_20",
    2.5: "coeff_ep_25",
    3.0: "coeff_ep_30",
}

MATERIAL_COEFF_MAP = {
    "acier": "coeff_acier",
    "inox": "coeff_inox",
    "alu": "coeff_alu",
    "galvanise": "coeff_galvanise",
}


def get_thickness_coeff(op: Operation, thickness_mm: float) -> float:
    """Retourne le coefficient d'épaisseur de l'opération pour l'épaisseur la plus proche dans le barème."""
    # Find nearest thickness
    thicknesses = sorted(THICKNESS_COEFF_MAP.keys())
    nearest = min(thicknesses, key=lambda t: abs(t - thickness_mm))
    attr = THICKNESS_COEFF_MAP[nearest]
    return float(getattr(op, attr, 1.0) or 1.0)


def get_material_coeff(op: Operation, material: str) -> float:
    """Retourne le coefficient matière de l'opération (défaut acier si matière inconnue)."""
    attr = MATERIAL_COEFF_MAP.get(material.lower(), "coeff_acier")
    return float(getattr(op, attr, 1.0) or 1.0)


def calculate_operation_time(
    op: Operation,
    quantity: float,
    material: str,
    thickness_mm: float,
    complexity_factor: float = 1.0,
) -> float:
    """Returns estimated time in minutes."""
    coeff_mat = get_material_coeff(op, material)
    coeff_ep = get_thickness_coeff(op, thickness_mm)
    time_min = (
        float(op.base_time_min) * quantity * coeff_mat * coeff_ep * complexity_factor
        + float(op.setup_time_min or 0)
    )
    return round(time_min, 2)


def get_machine_for_operation(db: Session, operation_type: str) -> Optional[Machine]:
    """Retourne la machine active la moins chère à l'heure pour un type d'opération donné."""
    return (
        db.query(Machine)
        .filter(Machine.operation_type == operation_type, Machine.status == "actif")
        .order_by(Machine.hourly_cost)
        .first()
    )


def get_delivery_date(db: Session, machine_id: int, required_time_min: float) -> datetime:
    """Estimate delivery date based on machine queue."""
    queue_items = (
        db.query(ProductionQueue)
        .filter(
            ProductionQueue.machine_id == machine_id,
            ProductionQueue.status.in_(["en_cours", "en_attente"]),
        )
        .all()
    )
    total_remaining = sum(float(q.remaining_time_min or 0) for q in queue_items)
    total_minutes = total_remaining + required_time_min
    # Assume 8h working days
    working_days = (total_minutes / 60) / 8
    delivery = datetime.now() + timedelta(days=max(1, int(working_days) + 1))
    return delivery


def calculate_production_line(
    db: Session,
    operation_type: str,
    quantity: float,
    material: str,
    thickness_mm: float,
    complexity_factor: float = 1.0,
) -> dict:
    """
    Calcule le temps, le coût et la date de livraison estimée pour une ligne de production.
    Retourne un dict avec les détails ou {"error": "..."} si l'opération ou la machine est introuvable.
    """
    op = db.query(Operation).filter(Operation.operation_type == operation_type).first()
    if not op:
        return {"error": f"Opération '{operation_type}' introuvable"}

    machine = get_machine_for_operation(db, operation_type)
    if not machine:
        return {"error": f"Aucune machine active pour '{operation_type}'"}

    time_min = calculate_operation_time(op, quantity, material, thickness_mm, complexity_factor)
    cost = round((time_min / 60) * float(machine.hourly_cost), 2)
    delivery = get_delivery_date(db, machine.id, time_min)

    return {
        "operation_id": op.id,
        "operation_name": op.name,
        "operation_type": operation_type,
        "machine_id": machine.id,
        "machine_name": machine.name,
        "time_min": time_min,
        "hourly_cost": float(machine.hourly_cost),
        "cost": cost,
        "estimated_delivery": delivery.date().isoformat(),
        "unit_of_measure": op.unit_of_measure,
    }
