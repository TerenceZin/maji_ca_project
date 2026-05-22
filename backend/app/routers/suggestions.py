"""
Suggestions intelligentes de composants et de production à partir d'une pièce.

Architecture RAG :
  • ArcelorMittal  → matching SQL structuré (matière + épaisseur ± 20%)
  • Bossard        → RAG léger : récupération SQL (supplier=Bossard)
                     puis génération via Claude Sonnet (matching sémantique notes→catalogue)
  • Production     → calcul pur barèmes (services/production.py), zéro IA
"""
import json
import math
import re
from typing import List, Optional

import anthropic
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import settings
from ..database import get_db
from ..models import CatalogItem, User
from ..services.production import (
    calculate_production_line,
    get_machine_for_operation,
)

router = APIRouter(prefix="/api/suggestions", tags=["suggestions"])

# ── Constantes ────────────────────────────────────────────────────────────────

MATIERE_KEYWORDS: dict[str, list[str]] = {
    "acier":     ["acier", "s235", "dc01", "s355", "hrc", "crc", "xc"],
    "inox":      ["inox", "304", "316", "inoxydable"],
    "alu":       ["alu", "aluminium", "5754", "5083", "6061", "h22", "h24"],
    "galvanise": ["galva", "galvanisé", "dx51", "zingué", "sendzimir"],
}

SCRAP_FACTOR = 1.15   # +15 % de chute sur la matière
MIN_CONFIDENCE = 0.55  # sous ce seuil → warning sur le match Bossard


# ── Schémas d'entrée ──────────────────────────────────────────────────────────

class TrouIn(BaseModel):
    forme: str
    diametre_mm: Optional[float] = None
    largeur_mm: Optional[float] = None
    hauteur_mm: Optional[float] = None
    quantite: int = 1


class PliIn(BaseModel):
    angle_deg: Optional[float] = None
    rayon_mm: Optional[float] = None
    longueur_mm: Optional[float] = None
    quantite: int = 1


class SuggestRequest(BaseModel):
    matiere: Optional[str] = None
    nuance: Optional[str] = None
    epaisseur_mm: Optional[float] = None
    surface_dev_m2: Optional[float] = None
    masse_g: Optional[float] = None
    longueur_decoupe_mm: Optional[float] = None
    notes: Optional[str] = None
    trous: List[TrouIn] = []
    plis: List[PliIn] = []


# ── Schémas de sortie ─────────────────────────────────────────────────────────

class ComponentResult(BaseModel):
    reference: str
    name: str
    supplier: str
    quantity: float
    unit: str
    unit_price: float
    total: float
    weight_g: Optional[float] = None
    price_change_flag: Optional[bool] = None
    confidence: float = 1.0   # 0–1 (1 = match parfait structuré)
    warning: Optional[str] = None


class SuggestComponentsResponse(BaseModel):
    components: List[ComponentResult]
    warnings: List[str]


class ProductionResult(BaseModel):
    operation_type: str
    operation_name: str
    machine_id: Optional[int] = None
    machine_name: Optional[str] = None
    quantity: float
    unit_of_measure: str
    material: str
    thickness_mm: float
    complexity_factor: float = 1.0
    time_min: float
    hourly_cost: float
    cost: float
    estimated_delivery: Optional[str] = None
    warning: Optional[str] = None


class SuggestProductionResponse(BaseModel):
    production: List[ProductionResult]
    warnings: List[str]


# ── Helpers ArcelorMittal ─────────────────────────────────────────────────────

def _parse_sheet_area_mm2(name: str) -> Optional[float]:
    """Extrait la surface de la feuille en mm² depuis le nom (ex: '1000x2000mm' → 2 000 000)."""
    m = re.search(r"(\d+)\s*[xX×]\s*(\d+)\s*mm", name)
    if m:
        return float(m.group(1)) * float(m.group(2))
    return None


def _arcelor_match(
    db: Session,
    matiere: Optional[str],
    nuance: Optional[str],
    epaisseur_mm: Optional[float],
    masse_g: Optional[float],
    surface_dev_m2: Optional[float] = None,
) -> tuple[Optional[ComponentResult], Optional[str]]:
    """Retourne (ComponentResult, warning_ou_None)."""

    items = (
        db.query(CatalogItem)
        .filter(
            CatalogItem.supplier == "ArcelorMittal",
            CatalogItem.category == "matiere_premiere",
        )
        .all()
    )

    if not items:
        return None, "Aucun article ArcelorMittal dans le catalogue"

    # Filtre par matière
    candidates = items
    if matiere:
        kws = MATIERE_KEYWORDS.get(matiere.lower(), [matiere.lower()])
        filtered = [i for i in items if any(k in i.name.lower() for k in kws)]
        if filtered:
            candidates = filtered
        else:
            return None, f"Aucun article ArcelorMittal correspondant à la matière « {matiere} » dans le catalogue"

    # Filtre par nuance (optionnel — n'élimine pas si absent)
    if nuance:
        nuance_filtered = [i for i in candidates if nuance.lower() in i.name.lower()]
        if nuance_filtered:
            candidates = nuance_filtered

    # Filtre par épaisseur (tolérance ±20 % ou ±0.2 mm)
    if epaisseur_mm:
        tol = max(0.2, epaisseur_mm * 0.20)
        thick_filtered = [
            i for i in candidates
            if i.thickness_mm is not None and abs(float(i.thickness_mm) - epaisseur_mm) <= tol
        ]
        if thick_filtered:
            candidates = sorted(thick_filtered, key=lambda i: abs(float(i.thickness_mm) - epaisseur_mm))
        else:
            return None, (
                f"Aucune tôle ArcelorMittal à {epaisseur_mm} mm trouvée dans le catalogue "
                f"(matière : {matiere or '?'})"
            )

    best = candidates[0]

    # Calcul de quantité : surface développée / surface feuille (priorité)
    # puis ratio massique si surface non disponible
    qty = 1.0
    warning = None
    if surface_dev_m2 and surface_dev_m2 > 0:
        sheet_area_mm2 = _parse_sheet_area_mm2(str(best.name))
        if sheet_area_mm2 and sheet_area_mm2 > 0:
            qty = round((surface_dev_m2 * 1_000_000 / sheet_area_mm2) * SCRAP_FACTOR, 4)
        elif masse_g and best.weight_g and float(best.weight_g) > 0:
            qty = round((masse_g / float(best.weight_g)) * SCRAP_FACTOR, 4)
        else:
            warning = f"Dimensions feuille non trouvées pour {best.reference} — quantité estimée à 1 feuille"
    elif masse_g and best.weight_g and float(best.weight_g) > 0:
        qty = round((masse_g / float(best.weight_g)) * SCRAP_FACTOR, 4)
    else:
        warning = f"Surface et poids manquants pour {best.reference} — quantité estimée à 1 feuille"

    total = round(qty * float(best.unit_price), 4)

    return ComponentResult(
        reference=str(best.reference),
        name=str(best.name),
        supplier="ArcelorMittal",
        quantity=qty,
        unit=str(best.unit),
        unit_price=float(best.unit_price),
        total=total,
        weight_g=float(best.weight_g) if best.weight_g else None,
        price_change_flag=bool(best.price_change_flag),
        confidence=1.0,
        warning=warning,
    ), None


# ── Helpers Bossard (Claude RAG) ──────────────────────────────────────────────

BOSSARD_PROMPT = """\
Tu es un expert en quincaillerie industrielle pour la tôlerie fine.
On t'a fourni des notes de fabrication d'une pièce et un catalogue de composants Bossard.

Notes de fabrication :
{notes}

Catalogue Bossard disponible (JSON) :
{catalog_json}

Identifie les composants Bossard mentionnés (explicitement ou implicitement) dans les notes.
Pour chaque composant trouvé, retourne sa quantité et un score de confiance (0.0 = incertain, 1.0 = certitude).

Retourne UNIQUEMENT un tableau JSON valide, sans texte avant ni après :
[
  {{"catalog_id": <int>, "quantity": <float>, "confidence": <float 0-1>, "reason": "<courte justification>"}}
]
Si aucun composant Bossard ne correspond, retourne [].
"""


def _bossard_match(
    db: Session,
    notes: str,
) -> tuple[list[ComponentResult], list[str]]:
    """Matching sémantique notes → catalogue Bossard via Claude Sonnet."""
    if not notes or not notes.strip():
        return [], []

    bossard_items = (
        db.query(CatalogItem)
        .filter(CatalogItem.supplier == "Bossard")
        .order_by(CatalogItem.name)
        .all()
    )
    if not bossard_items:
        return [], ["Aucun article Bossard dans le catalogue — ajoutez des références via le module Catalogue"]

    if settings.anthropic_api_key.startswith("sk-ant-dummy"):
        # Mode mock : retour vide avec avertissement
        return [], ["Clé API Anthropic non configurée — matching Bossard désactivé"]

    catalog_json = json.dumps(
        [
            {
                "id": i.id,
                "reference": i.reference,
                "name": i.name,
                "unit": i.unit,
                "unit_price": float(i.unit_price),
                "weight_g": float(i.weight_g) if i.weight_g else None,
            }
            for i in bossard_items
        ],
        ensure_ascii=False,
    )

    try:
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            messages=[
                {
                    "role": "user",
                    "content": BOSSARD_PROMPT.format(
                        notes=notes.strip(),
                        catalog_json=catalog_json,
                    ),
                }
            ],
        )
        raw = response.content[0].text.strip()
        # Nettoyer les balises markdown éventuelles
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        # Sauter tout préambule jusqu'au premier '[' (Haiku ajoute parfois du texte avant)
        bracket = raw.find("[")
        if bracket == -1:
            return [], ["Réponse Claude Bossard sans tableau JSON exploitable"]
        # raw_decode parse le premier JSON valide et ignore tout texte qui suit
        matches, _end = json.JSONDecoder().raw_decode(raw[bracket:])
    except Exception as e:
        return [], [f"Erreur matching Bossard (Claude) : {e}"]

    results: list[ComponentResult] = []
    warnings: list[str] = []
    item_by_id = {i.id: i for i in bossard_items}

    for m in matches:
        catalog_id = m.get("catalog_id")
        item = item_by_id.get(catalog_id)
        if not item:
            warnings.append(f"Composant Bossard id #{catalog_id} non trouvé dans le catalogue")
            continue

        confidence = float(m.get("confidence", 0))
        qty = float(m.get("quantity", 1))
        total = round(qty * float(item.unit_price), 4)

        warning = None
        if confidence < MIN_CONFIDENCE:
            warning = f"Match incertain ({int(confidence*100)}%) — {m.get('reason', '')}"
            warnings.append(f"Bossard {item.reference} : {warning}")

        results.append(
            ComponentResult(
                reference=str(item.reference),
                name=str(item.name),
                supplier="Bossard",
                quantity=qty,
                unit=str(item.unit),
                unit_price=float(item.unit_price),
                total=total,
                weight_g=float(item.weight_g) if item.weight_g else None,
                price_change_flag=bool(item.price_change_flag),
                confidence=confidence,
                warning=warning,
            )
        )

    return results, warnings


# ── Endpoint : composants ─────────────────────────────────────────────────────

@router.post("/components", response_model=SuggestComponentsResponse)
def suggest_components(
    body: SuggestRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Suggère les composants (matière ArcelorMittal + visserie Bossard) à partir
    des données géométriques et des notes de la pièce.
    """
    components: list[ComponentResult] = []
    warnings: list[str] = []

    # ── 1. ArcelorMittal ──
    if body.matiere or body.epaisseur_mm:
        result, warn = _arcelor_match(
            db, body.matiere, body.nuance, body.epaisseur_mm, body.masse_g, body.surface_dev_m2
        )
        if result:
            components.append(result)
        if warn:
            warnings.append(warn)
    else:
        warnings.append("Matière et épaisseur non renseignées — suggestion ArcelorMittal ignorée")

    # ── 2. Bossard (RAG Claude) ──
    bossard_results, bossard_warnings = _bossard_match(db, body.notes or "")
    components.extend(bossard_results)
    warnings.extend(bossard_warnings)

    return SuggestComponentsResponse(components=components, warnings=warnings)


# ── Endpoint : production ─────────────────────────────────────────────────────

@router.post("/production", response_model=SuggestProductionResponse)
def suggest_production(
    body: SuggestRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Calcule les lignes de production à partir de la géométrie pièce
    en utilisant les barèmes existants (opérations + machines).
    Aucun appel IA — calcul pur.
    """
    production: list[ProductionResult] = []
    warnings: list[str] = []

    matiere = (body.matiere or "acier").lower()
    ep = body.epaisseur_mm or 1.5

    def _add_line(op_type: str, qty: float, uom_override: Optional[str] = None) -> bool:
        """Tente de calculer une ligne, retourne False si impossible."""
        result = calculate_production_line(db, op_type, qty, matiere, ep)

        if "error" in result:
            # Détailler le warning selon la cause
            machine = get_machine_for_operation(db, op_type)
            if machine is None:
                warnings.append(
                    f"Aucune machine active de type « {op_type} » — "
                    "ajoutez une machine dans le module Production"
                )
            else:
                warnings.append(result["error"])
            return False

        uom = uom_override or result.get("unit_of_measure", "")
        production.append(
            ProductionResult(
                operation_type=op_type,
                operation_name=result["operation_name"],
                machine_id=result.get("machine_id"),
                machine_name=result.get("machine_name"),
                quantity=round(qty, 4),
                unit_of_measure=uom,
                material=matiere,
                thickness_mm=ep,
                time_min=result["time_min"],
                hourly_cost=result["hourly_cost"],
                cost=result["cost"],
                estimated_delivery=result.get("estimated_delivery"),
            )
        )
        return True

    # ── 1. Découpe laser ──────────────────────────────────────────────────────
    if body.longueur_decoupe_mm and body.longueur_decoupe_mm > 0:
        qty_m = round(body.longueur_decoupe_mm / 1000, 4)
        _add_line("decoupe_laser", qty_m, "mètre linéaire")
    else:
        warnings.append(
            "Longueur de découpe non renseignée — ligne découpe laser non calculée"
        )

    # ── 2. Pliage ─────────────────────────────────────────────────────────────
    nb_plis = sum(p.quantite for p in body.plis)
    if nb_plis > 0:
        _add_line("pliage", float(nb_plis), "pli")
    else:
        warnings.append("Aucun pli renseigné — ligne pliage non calculée")

    # ── 3. Ébavurage (si découpe significative ou plusieurs trous) ────────────
    nb_trous = sum(t.quantite for t in body.trous)
    longueur_m = (body.longueur_decoupe_mm or 0) / 1000
    if longueur_m > 0.3 or nb_trous > 2:
        _add_line("ebavurage", longueur_m or float(nb_trous), "mètre linéaire")

    # ── Vérification globale ──────────────────────────────────────────────────
    if not production:
        warnings.append(
            "Aucune ligne de production générée — vérifiez que des opérations et machines "
            "sont configurées dans le module Production"
        )

    return SuggestProductionResponse(production=production, warnings=warnings)
