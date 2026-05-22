import { PieceIn } from '../types'

export const DEFAULT_PACKAGING_MARGIN_MM = 30
export const DEFAULT_PALETTE_MM = { L: 1200, l: 800, h: 800 }

export interface PackageDimsInput {
  piece: Pick<PieceIn, 'longueur_mm' | 'largeur_mm' | 'hauteur_mm' | 'epaisseur_mm'> | null | undefined
  quantity: number
  packagingMarginMm?: number
  palette?: { L: number; l: number; h: number }
}

export interface PackageDimsResult {
  /** Longueur du colis en cm */
  L_cm: number
  /** Largeur du colis en cm */
  l_cm: number
  /** Hauteur du colis en cm */
  h_cm: number
  /** Nombre de colis identiques nécessaires */
  n_colis: number
  /** Quantité de pièces par colis */
  per_colis_qty: number
  /** Chaîne formatée prête pour l'input ("LxlxH" ou "N × LxlxH") */
  formatted: string
}

/**
 * Empilement vertical simple : poser la pièce à plat (L = max(longueur, largeur)),
 * empiler sur l'axe hauteur (ou épaisseur si pas de hauteur). Si la pile dépasse
 * la hauteur palette, on découpe en N colis identiques.
 * Une marge d'emballage est ajoutée sur chaque dimension.
 */
export function computePackageDimensions({
  piece,
  quantity,
  packagingMarginMm = DEFAULT_PACKAGING_MARGIN_MM,
  palette = DEFAULT_PALETTE_MM,
}: PackageDimsInput): PackageDimsResult | null {
  if (!piece) return null
  const { longueur_mm, largeur_mm, hauteur_mm, epaisseur_mm } = piece
  if (!longueur_mm || !largeur_mm) return null
  if (!quantity || quantity < 1) return null

  const L_unit = Math.max(longueur_mm, largeur_mm)
  const l_unit = Math.min(longueur_mm, largeur_mm)
  const h_unit = hauteur_mm && hauteur_mm > 0
    ? hauteur_mm
    : (epaisseur_mm && epaisseur_mm > 0 ? epaisseur_mm : 1)

  const usableH = Math.max(h_unit, palette.h - packagingMarginMm)
  const maxQtyPerColis = Math.max(1, Math.floor(usableH / h_unit))

  let n_colis = 1
  let per_colis_qty = quantity
  if (quantity > maxQtyPerColis) {
    n_colis = Math.ceil(quantity / maxQtyPerColis)
    per_colis_qty = Math.ceil(quantity / n_colis)
  }

  const stackH_mm = h_unit * per_colis_qty

  const L_cm = Math.ceil((L_unit + packagingMarginMm) / 10)
  const l_cm = Math.ceil((l_unit + packagingMarginMm) / 10)
  const h_cm = Math.ceil((stackH_mm + packagingMarginMm) / 10)

  const formatted = n_colis === 1
    ? `${L_cm}x${l_cm}x${h_cm}`
    : `${n_colis} × ${L_cm}x${l_cm}x${h_cm}`

  return { L_cm, l_cm, h_cm, n_colis, per_colis_qty, formatted }
}

export interface ParsedDimensions {
  L: number
  l: number
  h: number
  n: number
}

/** Parse "LxlxH" ou "N × LxlxH" (× ou x accepté pour le multiplicateur). */
export function parseDimensions(s: string): ParsedDimensions | null {
  if (!s) return null
  const trimmed = s.trim()
  // Optional "N ×" / "N x" prefix, then 3 dimensions separated by x / ×
  const m = trimmed.match(
    /^(?:(\d+)\s*[×x]\s*)?(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)$/i
  )
  if (!m) return null
  const num = (v: string) => parseFloat(v.replace(',', '.'))
  return {
    n: m[1] ? parseInt(m[1], 10) || 1 : 1,
    L: num(m[2]),
    l: num(m[3]),
    h: num(m[4]),
  }
}

/** Poids volumétrique aérien standard (5000 cm³/kg) en grammes, multiplié par n_colis. */
export function volumetricWeightG(dims: ParsedDimensions): number {
  return (dims.L * dims.l * dims.h * dims.n) / 5000 * 1000
}
