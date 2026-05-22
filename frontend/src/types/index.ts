export interface Client {
  id: number
  company_name: string
  address?: string
  contact_name?: string
  contact_email?: string
  phone?: string
  siret?: string
  payment_terms?: string
  default_discount?: number
  target_margin?: number
  created_at?: string
}

export interface CatalogItem {
  id: number
  reference: string
  name: string
  category: 'composant' | 'matiere_premiere'
  supplier: string
  unit_price: number
  unit: string
  weight_g?: number
  thickness_mm?: number
  moq?: number
  last_updated?: string
  price_change_flag?: boolean
  price_change_percent?: number
  previous_price?: number
}

export interface Operation {
  id: number
  name: string
  operation_type: string
  unit_of_measure: string
  base_time_min: number
  setup_time_min: number
}

export interface Machine {
  id: number
  name: string
  machine_type: string
  operation_type: string
  hourly_cost: number
  status: string
}

export interface QuoteComponent {
  reference: string
  name: string
  supplier: string
  quantity: number
  unit: string
  unit_price: number
  total: number
  weight_g?: number
  price_change_flag?: boolean
  price_change_percent?: number
  previous_price?: number
}

export interface QuoteProductionLine {
  operation_type: string
  operation_name: string
  machine_id?: number
  machine_name?: string
  quantity: number
  unit_of_measure: string
  material: string
  thickness_mm: number
  complexity_factor?: number
  time_min: number
  hourly_cost: number
  cost: number
  estimated_delivery?: string
}

export interface Carrier {
  id: number
  name: string
  service_type: string
  tarif_kg: number
  tarif_palette: number
  delai_moyen_j: number
  zones_geo: string
  active: boolean
}

export interface ProductTemplate {
  id: number
  reference: string
  name: string
  description?: string
  category?: string
  components_data: QuoteComponent[]
  production_data: QuoteProductionLine[]
  dimensions_colis: string
  poids_emballage_g: number
}

export interface QuoteTransport {
  mode: string
  carrier_id?: number
  carrier_name?: string
  weight_net_g: number
  weight_packaging_g: number
  weight_gross_g: number
  dimensions: string
  volumetric_weight_g: number
  zone: string
  cost: number
  /** Si true (par défaut), les dimensions colis sont recalculées depuis la pièce + quantité. */
  auto_dimensions?: boolean
  /** Marge d'emballage en mm appliquée à chaque dimension (défaut 30). */
  packaging_margin_mm?: number
  /** Nombre de colis identiques calculés automatiquement (cap palette). */
  n_colis?: number
}

export interface QuoteData {
  components: QuoteComponent[]
  production: QuoteProductionLine[]
  transport: QuoteTransport
  subtotal: number
  margin_amount: number
  piece?: PieceIn | null
  quantity_serie?: number
}

export interface Quote {
  id: number
  reference: string
  client_id?: number
  client_name?: string
  status: string
  data: QuoteData
  margin_percent: number
  total_ht: number
  total_ttc: number
  estimated_delivery_date?: string
  validation_comment?: string
  created_by?: number
  validated_by?: number
  created_at?: string
  updated_at?: string
}

export interface Template {
  id: number
  name: string
  type: 'client' | 'product' | 'combined'
  client_id?: number
  client_name?: string
  data: Partial<QuoteData>
  created_at?: string
  last_used_at?: string
  usage_count: number
}

export interface Notification {
  id: number
  title: string
  body?: string
  read: boolean
  quote_id?: number
  created_at?: string
}

// ---------- Pièce tôlerie ----------

export type TrouForme = 'circulaire' | 'carré' | 'rectangulaire' | 'ovale'

export interface TrouIn {
  forme: TrouForme
  diametre_mm?: number | null
  largeur_mm?: number | null
  hauteur_mm?: number | null
  quantite: number
}

export interface PliIn {
  angle_deg?: number | null
  rayon_mm?: number | null
  longueur_mm?: number | null
  quantite: number
}

export interface PieceIn {
  reference?: string | null
  designation?: string | null
  client_id?: number | null
  quote_id?: number | null
  plan_file_id?: number | null
  matiere?: string | null
  nuance?: string | null
  epaisseur_mm?: number | null
  traitement?: string | null
  longueur_mm?: number | null
  largeur_mm?: number | null
  hauteur_mm?: number | null
  surface_dev_m2?: number | null
  longueur_decoupe_mm?: number | null
  volume_mm3?: number | null
  masse_g?: number | null
  tolerances?: string | null
  notes?: string | null
  trous: TrouIn[]
  plis: PliIn[]
}

export interface Piece extends PieceIn {
  id: number
  created_at?: string
  updated_at?: string
}

/** Trou tel qu'extrait par l'IA (enrichi par rapport à TrouIn) */
export interface ExtractedTrou extends TrouIn {
  /** Côté du lamage carré ou Ø lamage si présent autour du trou */
  lamage_mm?: number | null
  /** Annotation libre liée au trou (ex. "logement écrou à sertir M6") */
  note?: string | null
}

/** Score de confiance par champ (0.0–1.0) renvoyé par l'IA */
export interface ExtractConfidence {
  reference?: number
  designation?: number
  matiere?: number
  epaisseur_mm?: number
  dimensions?: number
  trous?: number
  plis?: number
  longueur_decoupe_mm?: number
  [k: string]: number | undefined
}

/** JSON retourné par POST /api/ai/extract-plan */
export interface ExtractPlanResult {
  reference?: string | null
  designation?: string | null
  matiere?: string | null
  nuance?: string | null
  epaisseur_mm?: number | null
  traitement?: string | null
  longueur_mm?: number | null
  largeur_mm?: number | null
  hauteur_mm?: number | null
  surface_dev_m2?: number | null
  longueur_decoupe_mm?: number | null
  volume_mm3?: number | null
  masse_g?: number | null
  trous: ExtractedTrou[]
  plis: PliIn[]
  tolerances?: string | null
  notes?: string | null
  _confidence?: ExtractConfidence
}

export interface PlanFileMeta {
  id: number
  filename: string
  mime_type: string
}

// ---------- Suggestions IA ----------

export interface ComponentResult {
  reference: string
  name: string
  supplier: string
  quantity: number
  unit: string
  unit_price: number
  total: number
  weight_g?: number | null
  price_change_flag?: boolean | null
  confidence: number
  warning?: string | null
}

export interface SuggestComponentsResponse {
  components: ComponentResult[]
  warnings: string[]
}

export interface ProductionResult {
  operation_type: string
  operation_name: string
  machine_id?: number | null
  machine_name?: string | null
  quantity: number
  unit_of_measure: string
  material: string
  thickness_mm: number
  complexity_factor: number
  time_min: number
  hourly_cost: number
  cost: number
  estimated_delivery?: string | null
  warning?: string | null
}

export interface SuggestProductionResponse {
  production: ProductionResult[]
  warnings: string[]
}
