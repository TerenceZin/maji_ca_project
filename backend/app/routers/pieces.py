"""Pieces — CRUD pièces avec trous et plis imbriqués."""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Piece, Pli, Trou, User

router = APIRouter(prefix="/api/pieces", tags=["pieces"])


# ---------------------------------------------------------------------------
# Schémas Pydantic
# ---------------------------------------------------------------------------

class TrouIn(BaseModel):
    forme: str                       # circulaire | carré | rectangulaire | ovale
    diametre_mm: Optional[float] = None
    largeur_mm: Optional[float] = None
    hauteur_mm: Optional[float] = None
    quantite: int = 1


class TrouOut(TrouIn):
    id: int
    piece_id: int

    class Config:
        from_attributes = True


class PliIn(BaseModel):
    angle_deg: Optional[float] = None
    rayon_mm: Optional[float] = None
    longueur_mm: Optional[float] = None
    quantite: int = 1


class PliOut(PliIn):
    id: int
    piece_id: int

    class Config:
        from_attributes = True


class PieceIn(BaseModel):
    # Identification
    reference: Optional[str] = None
    designation: Optional[str] = None
    client_id: Optional[int] = None
    quote_id: Optional[int] = None
    plan_file_id: Optional[int] = None
    # Matière & Traitement
    matiere: Optional[str] = None
    nuance: Optional[str] = None
    epaisseur_mm: Optional[float] = None
    traitement: Optional[str] = None
    # Dimensions & Masse
    longueur_mm: Optional[float] = None
    largeur_mm: Optional[float] = None
    hauteur_mm: Optional[float] = None
    surface_dev_m2: Optional[float] = None
    longueur_decoupe_mm: Optional[float] = None
    volume_mm3: Optional[float] = None
    masse_g: Optional[float] = None
    # Notes & Tolérances
    tolerances: Optional[str] = None
    notes: Optional[str] = None
    # Sous-listes
    trous: List[TrouIn] = []
    plis: List[PliIn] = []


class PieceOut(BaseModel):
    id: int
    reference: Optional[str]
    designation: Optional[str]
    client_id: Optional[int]
    quote_id: Optional[int]
    plan_file_id: Optional[int]
    matiere: Optional[str]
    nuance: Optional[str]
    epaisseur_mm: Optional[float]
    traitement: Optional[str]
    longueur_mm: Optional[float]
    largeur_mm: Optional[float]
    hauteur_mm: Optional[float]
    surface_dev_m2: Optional[float]
    longueur_decoupe_mm: Optional[float]
    volume_mm3: Optional[float]
    masse_g: Optional[float]
    tolerances: Optional[str]
    notes: Optional[str]
    created_by: Optional[int]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    trous: List[TrouOut] = []
    plis: List[PliOut] = []

    class Config:
        from_attributes = True


class PieceListItem(BaseModel):
    """Version allégée pour les listings (sans trous/plis détaillés)."""
    id: int
    reference: Optional[str]
    designation: Optional[str]
    matiere: Optional[str]
    epaisseur_mm: Optional[float]
    masse_g: Optional[float]
    client_id: Optional[int]
    quote_id: Optional[int]
    plan_file_id: Optional[int]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _apply_trous_plis(db: Session, piece: Piece, trous: List[TrouIn], plis: List[PliIn]):
    """Supprime les anciens trous/plis et recrée ceux fournis."""
    for t in list(piece.trous):
        db.delete(t)
    for p in list(piece.plis):
        db.delete(p)
    db.flush()

    for t in trous:
        db.add(Trou(piece_id=piece.id, **t.model_dump()))
    for p in plis:
        db.add(Pli(piece_id=piece.id, **p.model_dump()))


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("", response_model=PieceOut, status_code=201)
def create_piece(
    body: PieceIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = body.model_dump(exclude={"trous", "plis"})
    piece = Piece(**data, created_by=current_user.id)
    db.add(piece)
    db.flush()  # obtenir l'id avant d'insérer les enfants

    for t in body.trous:
        db.add(Trou(piece_id=piece.id, **t.model_dump()))
    for p in body.plis:
        db.add(Pli(piece_id=piece.id, **p.model_dump()))

    db.commit()
    db.refresh(piece)
    return piece


@router.get("", response_model=List[PieceListItem])
def list_pieces(
    client_id: Optional[int] = Query(None),
    quote_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Piece)
    if client_id is not None:
        q = q.filter(Piece.client_id == client_id)
    if quote_id is not None:
        q = q.filter(Piece.quote_id == quote_id)
    return q.order_by(Piece.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{piece_id}", response_model=PieceOut)
def get_piece(
    piece_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    piece = db.get(Piece, piece_id)
    if not piece:
        raise HTTPException(404, "Pièce introuvable.")
    return piece


@router.put("/{piece_id}", response_model=PieceOut)
def update_piece(
    piece_id: int,
    body: PieceIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    piece = db.get(Piece, piece_id)
    if not piece:
        raise HTTPException(404, "Pièce introuvable.")

    # Mise à jour des champs scalaires
    for field, value in body.model_dump(exclude={"trous", "plis"}).items():
        setattr(piece, field, value)
    piece.updated_at = datetime.utcnow()

    # Remplacement complet des trous et plis
    _apply_trous_plis(db, piece, body.trous, body.plis)

    db.commit()
    db.refresh(piece)
    return piece


@router.delete("/{piece_id}", status_code=204)
def delete_piece(
    piece_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    piece = db.get(Piece, piece_id)
    if not piece:
        raise HTTPException(404, "Pièce introuvable.")
    db.delete(piece)
    db.commit()
