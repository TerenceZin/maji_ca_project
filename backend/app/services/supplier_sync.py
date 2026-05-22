"""
Synchronisation catalogue fournisseurs.
En V1: appelle les mocks locaux.
En production: appelle les vrais endpoints fournisseurs.
"""
import random
from typing import List, Optional
from sqlalchemy.orm import Session
from ..models import CatalogItem


def refresh_prices(db: Session, references: Optional[List[str]] = None) -> int:
    """
    Simule un refresh de prix depuis les fournisseurs.
    Applique une variation aléatoire réaliste (±0-3%) sur quelques articles.
    Retourne le nombre d'articles mis à jour.
    """
    q = db.query(CatalogItem)
    if references:
        q = q.filter(CatalogItem.reference.in_(references))
    items = q.all()

    updated = 0
    for item in items:
        # Simulation: ~15% de chance qu'un prix bouge légèrement
        if random.random() < 0.15:
            change_pct = random.uniform(-3.0, 3.0)
            old_price = float(item.unit_price)
            new_price = round(old_price * (1 + change_pct / 100), 4)
            item.previous_price = old_price
            item.unit_price = new_price
            item.price_change_percent = round(change_pct, 2)
            item.price_change_flag = abs(change_pct) >= 1.0
            updated += 1
        else:
            item.price_change_flag = False
            item.price_change_percent = 0

        from sqlalchemy.sql import func
        item.last_updated = func.now()

    db.commit()
    return updated
