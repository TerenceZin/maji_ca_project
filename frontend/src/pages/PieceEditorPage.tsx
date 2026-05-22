import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Save, Loader2, ChevronDown, ChevronUp, ArrowLeft, Layers } from 'lucide-react'
import api from '../api'
import { ExtractPlanResult, Piece, PieceIn, PlanFileMeta, PliIn, TrouIn } from '../types'
import PlanUploadCard from '../components/piece/PlanUploadCard'
import TrousTable from '../components/piece/TrousTable'
import PlisTable from '../components/piece/PlisTable'

// ---------------------------------------------------------------------------
// State interne du formulaire (strings pour les champs numériques)
// ---------------------------------------------------------------------------
interface FormState {
  reference: string
  designation: string
  matiere: string
  nuance: string
  epaisseur_mm: string
  traitement: string
  longueur_mm: string
  largeur_mm: string
  hauteur_mm: string
  surface_dev_m2: string
  longueur_decoupe_mm: string
  volume_mm3: string
  masse_g: string
  tolerances: string
  notes: string
  trous: TrouIn[]
  plis: PliIn[]
}

const EMPTY_FORM: FormState = {
  reference: '', designation: '', matiere: '', nuance: '',
  epaisseur_mm: '', traitement: '', longueur_mm: '', largeur_mm: '',
  hauteur_mm: '', surface_dev_m2: '', longueur_decoupe_mm: '',
  volume_mm3: '', masse_g: '', tolerances: '', notes: '',
  trous: [], plis: [],
}

const MATIERES = ['', 'acier', 'inox', 'alu', 'galvanise']
const TRAITEMENTS = ['', 'zingage', 'peinture', 'passivation', 'anodisation', 'grenaillage', 'autre']
const DENSITES: Record<string, number> = { acier: 7.85, inox: 7.93, alu: 2.70, galvanise: 7.85 }

const n2s = (v: number | null | undefined) => (v == null ? '' : String(v))
const s2n = (v: string): number | null => (v === '' ? null : parseFloat(v))

function resultToForm(r: ExtractPlanResult): Partial<FormState> {
  return {
    reference: r.reference ?? '',
    designation: r.designation ?? '',
    matiere: r.matiere ?? '',
    nuance: r.nuance ?? '',
    epaisseur_mm: n2s(r.epaisseur_mm),
    traitement: r.traitement ?? '',
    longueur_mm: n2s(r.longueur_mm),
    largeur_mm: n2s(r.largeur_mm),
    hauteur_mm: n2s(r.hauteur_mm),
    surface_dev_m2: n2s(r.surface_dev_m2),
    longueur_decoupe_mm: n2s(r.longueur_decoupe_mm),
    volume_mm3: n2s(r.volume_mm3),
    masse_g: n2s(r.masse_g),
    tolerances: r.tolerances ?? '',
    notes: r.notes ?? '',
    trous: r.trous ?? [],
    plis: r.plis ?? [],
  }
}

function pieceToForm(p: Piece): FormState {
  return {
    reference: p.reference ?? '',
    designation: p.designation ?? '',
    matiere: p.matiere ?? '',
    nuance: p.nuance ?? '',
    epaisseur_mm: n2s(p.epaisseur_mm),
    traitement: p.traitement ?? '',
    longueur_mm: n2s(p.longueur_mm),
    largeur_mm: n2s(p.largeur_mm),
    hauteur_mm: n2s(p.hauteur_mm),
    surface_dev_m2: n2s(p.surface_dev_m2),
    longueur_decoupe_mm: n2s(p.longueur_decoupe_mm),
    volume_mm3: n2s(p.volume_mm3),
    masse_g: n2s(p.masse_g),
    tolerances: p.tolerances ?? '',
    notes: p.notes ?? '',
    trous: p.trous ?? [],
    plis: p.plis ?? [],
  }
}

function formToPayload(f: FormState, planFileId: number | null): PieceIn {
  return {
    reference: f.reference || null,
    designation: f.designation || null,
    matiere: f.matiere || null,
    nuance: f.nuance || null,
    epaisseur_mm: s2n(f.epaisseur_mm),
    traitement: f.traitement || null,
    longueur_mm: s2n(f.longueur_mm),
    largeur_mm: s2n(f.largeur_mm),
    hauteur_mm: s2n(f.hauteur_mm),
    surface_dev_m2: s2n(f.surface_dev_m2),
    longueur_decoupe_mm: s2n(f.longueur_decoupe_mm),
    volume_mm3: s2n(f.volume_mm3),
    masse_g: s2n(f.masse_g),
    tolerances: f.tolerances || null,
    notes: f.notes || null,
    plan_file_id: planFileId,
    trous: f.trous,
    plis: f.plis,
  }
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------
export default function PieceEditorPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [planFileMeta, setPlanFileMeta] = useState<PlanFileMeta | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!isNew)
  const [open, setOpen] = useState({
    identification: true,
    matiere: true,
    dimensions: true,
    trous: true,
    plis: true,
    notes: true,
  })

  // Charger pièce existante
  useEffect(() => {
    if (!isNew) {
      api.get<Piece>(`/pieces/${id}`)
        .then((r) => {
          setForm(pieceToForm(r.data))
          if (r.data.plan_file_id) {
            api.get<PlanFileMeta>(`/plan-files/${r.data.plan_file_id}`)
              .then((pr) => setPlanFileMeta(pr.data))
              .catch(() => {})
          }
        })
        .catch(() => toast.error('Pièce introuvable'))
        .finally(() => setLoading(false))
    }
  }, [id, isNew])

  const patch = useCallback((fields: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...fields }))
  }, [])

  const field = (key: keyof FormState, value: string) => patch({ [key]: value } as any)

  // Surface développée = L × l en m²
  useEffect(() => {
    const l = parseFloat(form.longueur_mm)
    const w = parseFloat(form.largeur_mm)
    if (l > 0 && w > 0)
      setForm((f) => ({ ...f, surface_dev_m2: String(+((l * w) / 1_000_000).toFixed(8)).replace(/\.?0+$/, '') || '0' }))
  }, [form.longueur_mm, form.largeur_mm]) // eslint-disable-line react-hooks/exhaustive-deps

  // Volume = L × l × épaisseur en mm³ (formule tôlerie fine)
  useEffect(() => {
    const l = parseFloat(form.longueur_mm)
    const w = parseFloat(form.largeur_mm)
    const ep = parseFloat(form.epaisseur_mm)
    if (l > 0 && w > 0 && ep > 0)
      setForm((f) => ({ ...f, volume_mm3: String(+(l * w * ep).toFixed(2)) }))
  }, [form.longueur_mm, form.largeur_mm, form.epaisseur_mm]) // eslint-disable-line react-hooks/exhaustive-deps

  // Masse estimée = (volume_mm3 / 1000) × densité
  useEffect(() => {
    const vol = parseFloat(form.volume_mm3)
    const density = DENSITES[form.matiere]
    if (vol > 0 && density)
      setForm((f) => ({ ...f, masse_g: String(+((vol / 1000) * density).toFixed(1)) }))
  }, [form.volume_mm3, form.matiere]) // eslint-disable-line react-hooks/exhaustive-deps

  // Callback quand Claude a extrait les données
  const handleExtracted = (result: ExtractPlanResult, meta: PlanFileMeta) => {
    setPlanFileMeta(meta)
    patch(resultToForm(result) as Partial<FormState>)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = formToPayload(form, planFileMeta?.id ?? null)
      if (isNew) {
        const res = await api.post<Piece>('/pieces', payload)
        toast.success('Pièce créée')
        navigate(`/pieces/${res.data.id}`, { replace: true })
      } else {
        await api.put(`/pieces/${id}`, payload)
        toast.success('Pièce sauvegardée')
      }
    } catch {
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const toggle = (s: keyof typeof open) => setOpen((o) => ({ ...o, [s]: !o[s] }))

  if (loading) return <div className="p-8 text-gray-400">Chargement…</div>

  const SectionHeader = ({
    title, badge, section,
  }: { title: string; badge?: string; section: keyof typeof open }) => (
    <div
      className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 cursor-pointer select-none"
      onClick={() => toggle(section)}
    >
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
        {badge && <span className="text-xs bg-maji-100 text-maji-700 rounded-full px-2 py-0.5">{badge}</span>}
      </div>
      {open[section] ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
    </div>
  )

  const Input = ({ label, fieldKey, type = 'text', unit, placeholder }: {
    label: string; fieldKey: keyof FormState; type?: string; unit?: string; placeholder?: string
  }) => (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type={type}
          step={type === 'number' ? 'any' : undefined}
          value={form[fieldKey] as string}
          onChange={(e) => field(fieldKey, e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
        />
        {unit && <span className="text-xs text-gray-400 shrink-0">{unit}</span>}
      </div>
    </div>
  )

  const trousBadge = form.trous.length > 0 ? `${form.trous.length}` : undefined
  const plisBadge = form.plis.length > 0 ? `${form.plis.length}` : undefined

  return (
    <div className="flex flex-col h-full">
      {/* Barre d'actions */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-maji-600" />
            <div>
              <div className="font-bold text-gray-900 text-sm">
                {form.designation || form.reference || (isNew ? 'Nouvelle pièce' : `Pièce #${id}`)}
              </div>
              <div className="text-xs text-gray-400">Fiche de décomposition pièce</div>
            </div>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary gap-2"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Sauvegarder
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        <div className="max-w-3xl mx-auto p-4 space-y-4">

          {/* Plan upload + extraction Claude */}
          <PlanUploadCard
            planFileMeta={planFileMeta}
            onExtracted={handleExtracted}
            onClear={() => setPlanFileMeta(null)}
          />

          {/* ── Section 1 : Identification ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <SectionHeader title="1. Identification" section="identification" />
            {open.identification && (
              <div className="p-4 grid grid-cols-2 gap-4">
                <Input label="Référence pièce" fieldKey="reference" placeholder="ex. 21597494" />
                <Input label="Désignation" fieldKey="designation" placeholder="ex. SUPPORT REAR BRAKE" />
              </div>
            )}
          </div>

          {/* ── Section 2 : Matière & Traitement ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <SectionHeader title="2. Matière & Traitement" section="matiere" />
            {open.matiere && (
              <div className="p-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Matière</label>
                  <select
                    value={form.matiere}
                    onChange={(e) => field('matiere', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500 bg-white"
                  >
                    {MATIERES.map((m) => <option key={m} value={m}>{m || '— non renseigné —'}</option>)}
                  </select>
                </div>
                <Input label="Nuance" fieldKey="nuance" placeholder="ex. S235JR, 304, 5754…" />
                <Input label="Épaisseur" fieldKey="epaisseur_mm" type="number" unit="mm" placeholder="ex. 2" />
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Traitement</label>
                  <select
                    value={form.traitement}
                    onChange={(e) => field('traitement', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500 bg-white"
                  >
                    {TRAITEMENTS.map((t) => <option key={t} value={t}>{t || '— aucun —'}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* ── Section 3 : Dimensions & Masse ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <SectionHeader title="3. Dimensions & Masse" section="dimensions" />
            {open.dimensions && (
              <div className="p-4">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <Input label="Longueur" fieldKey="longueur_mm" type="number" unit="mm" />
                  <Input label="Largeur" fieldKey="largeur_mm" type="number" unit="mm" />
                  <Input label="Hauteur" fieldKey="hauteur_mm" type="number" unit="mm" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Surface développée" fieldKey="surface_dev_m2" type="number" unit="m²" />
                  <Input label="Longueur de découpe" fieldKey="longueur_decoupe_mm" type="number" unit="mm" />
                  <Input label="Volume" fieldKey="volume_mm3" type="number" unit="mm³" />
                  <div>
                    <Input label="Masse estimée unitaire" fieldKey="masse_g" type="number" unit="g" />
                    {parseFloat(form.masse_g) > 0 && (
                      <span className="text-xs text-gray-400 mt-0.5 block">
                        ({(parseFloat(form.masse_g) / 1000).toFixed(3)} kg)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Section 4 : Trous / Découpes ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <SectionHeader title="4. Trous / Découpes" badge={trousBadge} section="trous" />
            {open.trous && (
              <TrousTable
                rows={form.trous}
                onChange={(trous) => patch({ trous })}
              />
            )}
          </div>

          {/* ── Section 5 : Plis ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <SectionHeader title="5. Plis" badge={plisBadge} section="plis" />
            {open.plis && (
              <PlisTable
                rows={form.plis}
                onChange={(plis) => patch({ plis })}
              />
            )}
          </div>

          {/* ── Section 6 : Notes & Tolérances ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <SectionHeader title="6. Notes & Tolérances" section="notes" />
            {open.notes && (
              <div className="p-4 space-y-4">
                <Input label="Tolérances" fieldKey="tolerances" placeholder="ex. ISO 2768 -m" />
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Notes libres</label>
                  <textarea
                    rows={4}
                    value={form.notes}
                    onChange={(e) => field('notes', e.target.value)}
                    placeholder="Composants sertis, traitements spéciaux, remarques de fabrication…"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500 resize-none"
                  />
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
