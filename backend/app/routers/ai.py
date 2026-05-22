"""AI endpoint — extraction de géométrie pièce depuis un plan (PDF/image) via Claude vision."""
import base64
import io
import json
import re
from typing import List, Tuple

import anthropic
import pypdfium2 as pdfium
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import Image

from ..auth import get_current_user
from ..config import settings
from ..models import User

router = APIRouter(prefix="/api/ai", tags=["ai"])

# DPI utilisé pour rasteriser les PDF avant envoi à Claude.
# 300 DPI = bon compromis lisibilité des cotes fines / taille payload.
PDF_RENDER_DPI = 300
# Largeur max d'une page rendue (px). Au-delà, on redimensionne pour rester
# sous la limite Anthropic (~8000 px max côté, mais on vise plus petit pour le payload).
MAX_IMAGE_WIDTH = 2400
# Limite de pages PDF traitées (un plan tôlerie tient en général sur 1-2 pages).
MAX_PDF_PAGES = 4

# ---------------------------------------------------------------------------
# Prompt système — extraction plan tôlerie fine
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """Tu es un expert en tôlerie fine industrielle chez Maji, spécialisé
dans la lecture de plans techniques 2D (DXF/PDF de SolidWorks, Inventor,
AutoCAD). À partir d'un plan de fabrication (image rendue d'un PDF), tu dois
extraire les informations géométriques et techniques de la pièce pour
préremplir un devis.

Retourne UNIQUEMENT un objet JSON valide (sans texte avant ni après, sans balise
markdown), respectant exactement le schéma ci-dessous.

==============================
SCHÉMA JSON DE SORTIE (STRICT)
==============================

{
  "reference": string | null,
  "designation": string | null,
  "matiere": "acier" | "inox" | "alu" | "galvanise" | null,
  "nuance": string | null,
  "epaisseur_mm": number | null,
  "traitement": "zingage" | "peinture" | "passivation" | "anodisation" | null,
  "longueur_mm": number | null,
  "largeur_mm": number | null,
  "hauteur_mm": number | null,
  "surface_dev_m2": number | null,      // surface développée en m²  (ex: 0.0036 pour 60×60mm)
  "longueur_decoupe_mm": number | null,
  "volume_mm3": number | null,           // volume en mm³ = L×l×épaisseur (ex: 7200 pour 60×60×2)
  "masse_g": number | null,
  "trous": [
    {
      "forme": "circulaire" | "ovale" | "rectangulaire" | "carré" | "polygonal",
      "diametre_mm": number | null,    // rempli SI forme = "circulaire"
      "largeur_mm": number | null,     // rempli SI forme ≠ "circulaire"
      "hauteur_mm": number | null,     // rempli SI forme ≠ "circulaire"
      "quantite": integer,
      "lamage_mm": number | null,      // côté du lamage carré ou Ø lamage si présent (sinon null)
      "note": string | null            // ex. "écrou à sertir M6 logé", "fraisure 90°"…
    }
  ],
  "plis": [
    {
      "angle_deg": number,             // angle de pliage en degrés (typiquement 90, 45, 135…)
      "rayon_mm": number | null,
      "longueur_mm": number | null,    // longueur de l'arête pliée
      "quantite": integer
    }
  ],
  "tolerances": string | null,
  "notes": string | null,              // composants sertis, traitements spéciaux, observations
  "_confidence": {                     // score 0.0–1.0 par champ ou groupe — OBLIGATOIRE
    "reference": number,
    "designation": number,
    "matiere": number,
    "epaisseur_mm": number,
    "dimensions": number,              // longueur/largeur/hauteur globalement
    "trous": number,                   // confiance globale sur la liste des trous
    "plis": number,                    // confiance globale sur la liste des plis
    "longueur_decoupe_mm": number
  }
}

Règles de confiance : 1.0 = lu sans ambiguïté dans une nomenclature ou cote
nette ; 0.7–0.9 = inféré d'une vue claire ; 0.4–0.6 = déduit, ambigu, partiel ;
< 0.4 = non lisible / absent / forte hésitation. Ne mens pas en mettant 1.0
partout — un champ null doit avoir une confiance ≤ 0.3.

==============================
RAISONNEMENT STRUCTURÉ — OBLIGATOIRE
==============================

Avant d'émettre le JSON, dans ta réflexion interne (extended thinking),
procède en TROIS phases :

PHASE 1 — OBSERVATION (lecture brute, sans interprétation)
  - Liste toutes les cotes lisibles (Ø, dimensions, R…), telles qu'écrites.
  - Liste toutes les annotations textuelles (LAMAGE, CSK, CRIMPING NUT,
    TYP, REP, M6, S2S…).
  - Identifie les vues présentes : vue de face, vue de dessus, vue de côté,
    vue isométrique, vues de détail.
  - Repère les tableaux : nomenclature (REP/DESIGNATION/QTY ou
    ITEM/DESCRIPTION/QTY), tableau de plis (BENDS), tableau de trous (HOLE
    TABLE), cartouche (TITLE BLOCK).

PHASE 2 — INTERPRÉTATION (applique les règles de désambiguïsation ci-dessous)
  - Pour chaque cote XxY : est-ce une découpe indépendante, un lamage, un pan
    coupé, ou un détail d'écrou serti ?
  - Pour chaque pli : compte les changements de direction sur la vue de profil.
  - Pour chaque composant nommé : écrou à sertir vs écrou hex vs vis ?

PHASE 3 — CLASSIFICATION & ÉMISSION
  - Affecte chaque élément à `trous` / `plis` / `notes` / périmètre extérieur.
  - Calcule longueur_decoupe_mm.
  - Évalue la confiance par champ.
  - Produis le JSON.

==============================
RÈGLES DE DÉSAMBIGUÏSATION — CRITIQUES
==============================

A. LAMAGE / CHANFREIN AUTOUR D'UN TROU ≠ DÉCOUPE
   Indices d'un lamage (PAS d'une découpe indépendante) :
     • cote "AxB" inscrite à proximité immédiate d'un Ø, avec flèche pointant
       vers le trou ou cercle concentrique au trou
     • mots-clés : LAMAGE, LAM, CSK, COUNTERBORE, C'BORE, COUNTERSINK, SPOTFACE,
       FRAISAGE, CHANFREIN, BAVURE
     • cote portée dans une vue de détail centrée sur le trou
     • valeur typique : 5x5, 6x6, 8x8 (logement d'écrou à sertir), ou Ø
       légèrement supérieur au trou principal
   ⇒ Action : NE PAS créer de ligne séparée dans `trous`. Renseigne
     `lamage_mm` sur le trou correspondant et précise dans `note` (ex.
     "lamage carré 5x5 pour écrou à sertir M6").
   ⚠ Erreur classique à éviter : "2x 5x5" à côté d'un Ø8,75 →
     ce N'EST PAS une découpe carrée 5x5 quantité 2.

B. PAN COUPÉ / CHANFREIN D'ANGLE ≠ DÉCOUPE CARRÉE
   Indices d'un pan coupé (= partie du contour extérieur, traité par le laser
   en un seul tour de découpe) :
     • cote "XxY" placée sur un coin extérieur de la pièce
     • notation "45° x N", "CHANFREIN", "PAN COUPÉ", "CHAMFER"
     • diagonale visible au coin sur la vue principale
     • la cote est *symétrique sur les 4 coins* ou répétée "TYP 4x"
   ⇒ Action : NE PAS l'inscrire dans `trous`. Le pan coupé est intégré au
     périmètre extérieur de découpe ; ajuste longueur_decoupe_mm en
     conséquence (le coin de longueur √(X²+Y²) remplace deux segments de
     X et Y du rectangle théorique). Mentionne dans `notes` : "4 pans
     coupés 20x20 aux angles".
   ⚠ Erreur classique à éviter : "2x 20x20" sur les coins → ce ne sont
     PAS deux découpes carrées 20x20.

C. COMPTAGE DES PLIS — VUE DE PROFIL
   Sur la vue de côté (ou de profil), trace mentalement la silhouette de la
   tôle. Compte le nombre de SEGMENTS RECTILIGNES distincts.
       nombre_de_plis = nombre_de_segments − 1
   Cas typiques :
     • L-bend : 2 segments → 1 pli
     • Z-bend : 3 segments → 2 plis  ⚠ ERREUR FRÉQUENTE : ne compter qu'1 pli
     • U-bend : 3 segments → 2 plis
     • Hat / chapeau : 5 segments → 4 plis
   Chaque changement de direction = un pli. Vérifie en regardant la pièce
   isométrique : chaque arête vive non droite est un pli.

D. ÉCROUS — CRIMPING NUT vs DIN 934
   Vocabulaire à reconnaître précisément :
     • ÉCROU À SERTIR / RIVET NUT / CRIMPING NUT / NUTSERT / PEM nut /
       écrou aveugle / blind rivet nut → composant SERTI dans un trou Ø
       calibré de la tôle (ex. M6 → Ø9 + lamage 5x5). Référence Bossard
       typique : S2S, B-NK, RIVKLE.
     • ÉCROU HEXAGONAL / DIN 934 / écrou H / hex nut → écrou standard
       VISSÉ sur une vis. Aucun rapport avec la tôlerie en elle-même.
   Si le plan dit "ECROU A SERTIR M6", "CRIMPING NUT M6", "M6 RIVET NUT",
   "PEM M6" → c'est un écrou à sertir, à mentionner dans `notes` avec sa
   référence et la quantité (ex. "2x écrou à sertir M6 S2S — Bossard").
   N'écris JAMAIS "DIN 934" ou "écrou hex" si le plan n'utilise pas ce
   terme exact.

E. PRIORITÉ NOMENCLATURE
   Si le plan contient une nomenclature structurée (tableau REP/DESIGNATION/QTY,
   ITEM/DESCRIPTION/QTY, hole table, bend table…), c'est ta SOURCE PRIMAIRE.
   Les vues servent à confirmer mais pas à contredire.
   En cas de conflit nomenclature vs vue : fais confiance à la nomenclature
   et signale le conflit dans `notes`.

==============================
RÈGLES NUMÉRIQUES
==============================

1. DÉCIMALES — NE JAMAIS ARRONDIR
   - Recopie chaque cote EXACTEMENT comme écrite (virgule = point décimal).
   - "Ø8,75" → 8.75. "Ø7,5" → 7.5. JAMAIS 8 ni 9 ni 4.
   - Si vraiment illisible → null + confiance ≤ 0.3. Jamais de valeur inventée.

2. PLIS — VALEURS OBLIGATOIRES SI PLI PRÉSENT
   - Cherche le tableau "PLIAGES" / "BENDS" avec colonnes Angle / Rayon / Longueur.
   - Tu DOIS remplir angle_deg pour chaque pli détecté.
   - rayon_mm : cherche "R2", "R1.5", "BEND RADIUS = X". Si non spécifié,
     en tôlerie fine la valeur usuelle = épaisseur de tôle, mais ne la mets
     QUE si le cartouche dit "R = ép." ou similaire. Sinon → null + confiance basse.
   - longueur_mm = longueur de l'arête pliée (souvent égale à une dimension
     perpendiculaire au pli sur la pièce dépliée).

3. LONGUEUR DE DÉCOUPE — CALCUL OBLIGATOIRE
     longueur_decoupe_mm = périmètre extérieur (incluant pans coupés)
                         + Σ (périmètre × quantité) de tous les éléments de
                           `trous` (lamages NON comptés, ils ne sont pas
                           découpés au laser mais usinés)
   - Trou circulaire : périmètre = π × diametre_mm
   - Forme rectangulaire/carrée : périmètre = 2 × (largeur + hauteur)
   - Forme ovale (oblong) : périmètre ≈ π × largeur + 2 × (hauteur − largeur)
   - Si tu obtiens une valeur < périmètre extérieur seul → tu t'es trompé.

4. MATIÈRE / NUANCE / TRAITEMENT
   - Lis le cartouche (bloc bas-droite). Si non renseigné explicitement → null.
   - Ne devine JAMAIS la matière à partir d'une couleur de rendu.

==============================
CHECKLIST FINALE — AVANT D'ÉMETTRE LE JSON
==============================

Réponds mentalement à chaque question. Si une réponse est NON, retourne en
PHASE 2.

□ 1. Pour CHAQUE ligne non-circulaire de `trous` : ai-je vérifié que ce
     n'est ni un lamage (cote proche d'un Ø + mot-clé LAMAGE/CSK), ni un
     pan coupé (cote sur un angle du contour extérieur) ?
□ 2. Sur la vue de profil, ai-je compté le nombre de segments rectilignes ?
     Le nombre de plis détectés est-il bien (segments − 1) ?
□ 3. Si un écrou est mentionné, ai-je distingué "à sertir" vs "hexagonal"
     en lisant le terme exact du plan, sans extrapoler ?
□ 4. Ai-je consulté la nomenclature (REP/DESIGNATION/QTY) en priorité, si
     elle existe ?
□ 5. Toutes mes cotes décimales sont-elles recopiées exactement (8,75 ≠ 8) ?
□ 6. longueur_decoupe_mm ≥ périmètre extérieur ?
□ 7. Pour chaque champ vraiment absent → null, et `_confidence` correspondant
     ≤ 0.3 ?

==============================
FEW-SHOT — CAS PIÈGES À MAÎTRISER
==============================

— EXEMPLE 1 : Lamage autour d'un trou (PIÈGE FRÉQUENT) —
Plan : 4 trous Ø8,75 répartis sur la pièce, avec sur chaque trou
l'annotation "5x5 LAMAGE TYP" et flèche pointant vers le trou.
Sortie correcte :
"trous": [
  {"forme": "circulaire", "diametre_mm": 8.75, "largeur_mm": null,
   "hauteur_mm": null, "quantite": 4, "lamage_mm": 5.0,
   "note": "lamage carré 5x5 pour logement écrou à sertir M6"}
]
INCORRECT (ne fais PAS ça) :
  une ligne {"forme":"carré","largeur_mm":5,"hauteur_mm":5,"quantite":4} séparée.

— EXEMPLE 2 : Pan coupé d'angle (PIÈGE FRÉQUENT) —
Plan : pièce rectangulaire 100x60, avec sur chaque coin extérieur la cote
"20x20" et notation "TYP 4x".
Sortie correcte :
"trous": [],
"longueur_decoupe_mm": 2*(100+60) - 4*(20+20) + 4*sqrt(20²+20²) ≈ 320 - 160 + 113.1 = 273.1
"notes": "4 pans coupés 20x20 aux angles extérieurs"
INCORRECT : 4 lignes "carré 20x20" dans `trous`.

— EXEMPLE 3 : Z-bend (PIÈGE FRÉQUENT) —
Plan : vue de côté en forme de Z (3 segments rectilignes : un horizontal en
bas, un vertical, un horizontal en haut).
Sortie correcte :
"plis": [
  {"angle_deg": 90.0, "rayon_mm": 2.0, "longueur_mm": 60.0, "quantite": 2}
]
INCORRECT : "quantite": 1.

— EXEMPLE 4 : Écrou à sertir vs hex —
Plan : nomenclature dit "M6 CRIMPING NUT - 2 PCS - REF S2S-M6".
Sortie correcte :
"notes": "2x écrou à sertir M6 S2S (Bossard) — fourniture séparée"
INCORRECT : "notes": "2x écrou hex M6 DIN 934".

— EXEMPLE 5 : Cas complet de référence (SUPPORT REAR BRAKE) —
Pièce inox 304 ép. 2 mm, 60×60×20, avec :
  - 2 trous Ø8,75 chacun avec lamage 5x5 (logement écrou à sertir M6)
  - 2 trous Ø7,5
  - vue de côté en Z (3 segments) → 2 plis 45° rayon 2 longueur 60
  - 2 écrous à sertir M6 S2S
  - pas de pan coupé sur le contour
Sortie correcte :
{
  "reference": "21597494",
  "designation": "SUPPORT REAR BRAKE",
  "matiere": "inox", "nuance": "304",
  "epaisseur_mm": 2.0, "traitement": null,
  "longueur_mm": 60.0, "largeur_mm": 60.0, "hauteur_mm": 20.0,
  "surface_dev_m2": 0.0052,
  "longueur_decoupe_mm": 342.1,
  "volume_mm3": 13200.0, "masse_g": 103.5,
  "trous": [
    {"forme": "circulaire", "diametre_mm": 8.75, "largeur_mm": null,
     "hauteur_mm": null, "quantite": 2, "lamage_mm": 5.0,
     "note": "lamage carré 5x5 pour écrou à sertir M6"},
    {"forme": "circulaire", "diametre_mm": 7.5, "largeur_mm": null,
     "hauteur_mm": null, "quantite": 2, "lamage_mm": null, "note": null}
  ],
  "plis": [
    {"angle_deg": 45.0, "rayon_mm": 2.0, "longueur_mm": 60.0, "quantite": 2}
  ],
  "tolerances": "ISO 2768 -m",
  "notes": "2x écrou à sertir M6 CL8 S2S (Bossard) — fourniture séparée",
  "_confidence": {
    "reference": 0.95, "designation": 0.95, "matiere": 0.9,
    "epaisseur_mm": 0.95, "dimensions": 0.9,
    "trous": 0.85, "plis": 0.8, "longueur_decoupe_mm": 0.75
  }
}

Note : longueur_decoupe = périmètre extérieur (240) + 2×π×8,75 (54.98) +
2×π×7,5 (47.12) ≈ 342.1 mm. Les lamages 5x5 ne sont PAS comptés (ils sont
usinés, pas découpés). Pas de "découpe carrée 5x5" ni "20x20" inventée.

==============================
RÉPONSE
==============================

JSON pur, aucun texte hors JSON, aucune balise markdown. Toutes les valeurs
numériques en nombres (pas de chaînes "8.75"). null pour tout champ
vraiment absent du plan, avec une confiance correspondante ≤ 0.3."""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_dummy_key(key: str) -> bool:
    """Retourne True si la clé API est absente ou factice (préfixe sk-ant-dummy), pour basculer en mode démo."""
    return not key or key.startswith("sk-ant-dummy")


def _strip_json_fences(raw: str) -> str:
    """Retire les éventuelles balises ```json ... ``` si le modèle en ajoute."""
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return raw.strip()


def _build_mock_response() -> dict:
    """Réponse de démonstration quand aucune clé API n'est configurée."""
    return {
        "reference": "DEMO-001",
        "designation": "Pièce de démonstration (aucune clé API configurée)",
        "matiere": "inox",
        "nuance": "304",
        "epaisseur_mm": 2.0,
        "traitement": None,
        "longueur_mm": 60.0,
        "largeur_mm": 60.0,
        "hauteur_mm": 20.0,
        "surface_dev_m2": 0.0052,
        "longueur_decoupe_mm": 342.1,
        "volume_mm3": 13200.0,
        "masse_g": 103.5,
        "trous": [
            {"forme": "circulaire", "diametre_mm": 8.75, "largeur_mm": None, "hauteur_mm": None, "quantite": 2,
             "lamage_mm": 5.0, "note": "lamage carré 5x5 pour écrou à sertir M6"},
            {"forme": "circulaire", "diametre_mm": 7.5, "largeur_mm": None, "hauteur_mm": None, "quantite": 2,
             "lamage_mm": None, "note": None},
        ],
        "plis": [
            {"angle_deg": 45.0, "rayon_mm": 2.0, "longueur_mm": 60.0, "quantite": 2},
        ],
        "tolerances": "ISO 2768 -m",
        "notes": "2x écrou à sertir M6 CL8 S2S (Bossard) — fourniture séparée. Vue de côté en Z = 2 plis (pas 1).",
        "_confidence": {
            "reference": 0.95,
            "designation": 0.95,
            "matiere": 0.9,
            "epaisseur_mm": 0.95,
            "dimensions": 0.9,
            "trous": 0.85,
            "plis": 0.8,
            "longueur_decoupe_mm": 0.75,
        },
    }


def _is_pdf(mime_type: str, filename: str) -> bool:
    """Détecte si le fichier uploadé est un PDF à partir du MIME type ou de l'extension."""
    return "pdf" in (mime_type or "").lower() or filename.lower().endswith(".pdf")


def _detect_image_media_type(mime_type: str, filename: str) -> str:
    """Déduit le media type image (image/png, image/jpeg…) depuis le MIME type ou l'extension du fichier."""
    mime_lower = (mime_type or "").lower()
    fn = filename.lower()
    if "png" in mime_lower or fn.endswith(".png"):
        return "image/png"
    if "jpeg" in mime_lower or "jpg" in mime_lower or fn.endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    if "gif" in mime_lower or fn.endswith(".gif"):
        return "image/gif"
    if "webp" in mime_lower or fn.endswith(".webp"):
        return "image/webp"
    return "image/png"


def _render_pdf_to_pngs(pdf_bytes: bytes) -> List[Tuple[str, str]]:
    """
    Rasterise un PDF en images PNG haute résolution.
    Retourne une liste de tuples (media_type, base64_data) — une entrée par page.
    Limite à MAX_PDF_PAGES pages pour éviter les payloads énormes.
    """
    pdf = pdfium.PdfDocument(pdf_bytes)
    n_pages = min(len(pdf), MAX_PDF_PAGES)
    # pypdfium2 utilise un facteur d'échelle = DPI / 72
    scale = PDF_RENDER_DPI / 72.0

    pages: List[Tuple[str, str]] = []
    for i in range(n_pages):
        page = pdf[i]
        bitmap = page.render(scale=scale)
        pil_image = bitmap.to_pil()

        # Redimensionner si trop large (préserve le ratio)
        if pil_image.width > MAX_IMAGE_WIDTH:
            ratio = MAX_IMAGE_WIDTH / pil_image.width
            new_size = (MAX_IMAGE_WIDTH, int(pil_image.height * ratio))
            pil_image = pil_image.resize(new_size, Image.LANCZOS)

        # Convertir en RGB (PNG peut être RGBA)
        if pil_image.mode != "RGB":
            pil_image = pil_image.convert("RGB")

        buf = io.BytesIO()
        pil_image.save(buf, format="PNG", optimize=True)
        b64 = base64.standard_b64encode(buf.getvalue()).decode("utf-8")
        pages.append(("image/png", b64))

    return pages


# ---------------------------------------------------------------------------
# Endpoint principal
# ---------------------------------------------------------------------------

@router.post("/extract-plan")
async def extract_plan(
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
):
    """
    Accepte un plan au format PDF ou image (PNG, JPG…).
    - PDF → rendu en PNG haute résolution (300 DPI) page par page
    - Image → envoyée directement
    Envoie le résultat à Claude Opus 4.7 (vision) et retourne les champs
    du devis pré-remplis en JSON.
    """
    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(400, "Fichier vide.")

    if _is_dummy_key(settings.anthropic_api_key):
        return _build_mock_response()

    filename = file.filename or ""
    content_type = file.content_type or ""

    # Construire les blocs d'image à envoyer à Claude
    image_blocks = []
    try:
        if _is_pdf(content_type, filename):
            pages = _render_pdf_to_pngs(raw_bytes)
            if not pages:
                raise HTTPException(422, "PDF vide ou illisible.")
            for media_type, b64_data in pages:
                image_blocks.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": b64_data,
                    },
                })
        else:
            media_type = _detect_image_media_type(content_type, filename)
            b64_data = base64.standard_b64encode(raw_bytes).decode("utf-8")
            image_blocks.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": b64_data,
                },
            })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(422, f"Impossible de lire le plan : {e}")

    user_content = list(image_blocks) + [
        {
            "type": "text",
            "text": (
                "Analyse ce plan de fabrication (rendu haute résolution).\n\n"
                "Procède selon les TROIS phases de raisonnement structuré du "
                "system prompt :\n"
                "  1) OBSERVATION — relève les cotes, annotations, vues et "
                "tableaux ;\n"
                "  2) INTERPRÉTATION — applique les règles de désambiguïsation "
                "(lamage ≠ découpe, pan coupé ≠ découpe, Z-bend = 2 plis, "
                "écrou à sertir ≠ DIN 934) ;\n"
                "  3) CLASSIFICATION — émets le JSON.\n\n"
                "Vérifications obligatoires avant de retourner le JSON :\n"
                "  • cotes décimales recopiées exactement (8,75 ≠ 8) ;\n"
                "  • toute cote non circulaire dans `trous` n'est ni un "
                "lamage ni un pan coupé ;\n"
                "  • plis comptés via les segments de la vue de profil "
                "(segments − 1) ;\n"
                "  • si nomenclature REP/DESIGNATION/QTY présente, l'utiliser "
                "comme source primaire ;\n"
                "  • `_confidence` rempli pour chaque champ ;\n"
                "  • longueur_decoupe_mm ≥ périmètre extérieur.\n\n"
                "Retourne UNIQUEMENT le JSON conforme au schéma."
            ),
        },
    ]

    try:
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

        with client.messages.stream(
            model="claude-opus-4-7",
            max_tokens=4096,
            thinking={"type": "adaptive"},
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_content}],
        ) as stream:
            message = stream.get_final_message()

        text_content = next(
            (block.text for block in message.content if block.type == "text"),
            None,
        )
        if not text_content:
            raise HTTPException(422, "Claude n'a retourné aucun texte.")

        cleaned = _strip_json_fences(text_content)
        result = json.loads(cleaned)
        # Normalise les noms de champs anciens (surface_dev_cm2 → m², volume_cm3 → mm³)
        if "surface_dev_cm2" in result and "surface_dev_m2" not in result:
            v = result.pop("surface_dev_cm2")
            result["surface_dev_m2"] = round(v / 10000, 8) if v is not None else None
        if "volume_cm3" in result and "volume_mm3" not in result:
            v = result.pop("volume_cm3")
            result["volume_mm3"] = round(v * 1000, 2) if v is not None else None
        return result

    except json.JSONDecodeError as e:
        raise HTTPException(422, f"Réponse Claude non parseable en JSON : {e}")
    except anthropic.APIStatusError as e:
        raise HTTPException(e.status_code, f"Erreur API Anthropic : {e.message}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Erreur extraction plan : {str(e)}")
