"""Plan files — upload et récupération de fichiers plan (PDF/image)."""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import PlanFile, User

router = APIRouter(prefix="/api/plan-files", tags=["plan-files"])

ALLOWED_MIME = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
}
MAX_SIZE_MB = 20


class PlanFileMeta(BaseModel):
    """Métadonnées retournées après upload (sans les bytes)."""
    id: int
    filename: str
    mime_type: str

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

@router.post("/upload", response_model=PlanFileMeta, status_code=201)
async def upload_plan_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Stocke un plan (PDF ou image) en base et retourne son id + métadonnées.
    Taille max : 20 Mo.
    """
    mime = (file.content_type or "").lower()
    if mime not in ALLOWED_MIME:
        raise HTTPException(
            400,
            f"Type de fichier non supporté : {mime}. "
            f"Formats acceptés : {', '.join(sorted(ALLOWED_MIME))}",
        )

    raw = await file.read()
    size_mb = len(raw) / (1024 * 1024)
    if size_mb > MAX_SIZE_MB:
        raise HTTPException(
            413, f"Fichier trop volumineux ({size_mb:.1f} Mo). Maximum : {MAX_SIZE_MB} Mo."
        )

    plan = PlanFile(
        filename=file.filename or "plan",
        mime_type=mime,
        data=raw,
        created_by=current_user.id,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


# ---------------------------------------------------------------------------
# Téléchargement
# ---------------------------------------------------------------------------

@router.get("/{plan_id}/download")
def download_plan_file(
    plan_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Retourne le fichier plan brut (pour affichage dans le navigateur)."""
    plan = db.get(PlanFile, plan_id)
    if not plan:
        raise HTTPException(404, "Plan introuvable.")

    return Response(
        content=bytes(plan.data),
        media_type=plan.mime_type,
        headers={"Content-Disposition": f'inline; filename="{plan.filename}"'},
    )


# ---------------------------------------------------------------------------
# Métadonnées seules
# ---------------------------------------------------------------------------

@router.get("/{plan_id}", response_model=PlanFileMeta)
def get_plan_file_meta(
    plan_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    plan = db.get(PlanFile, plan_id)
    if not plan:
        raise HTTPException(404, "Plan introuvable.")
    return plan
