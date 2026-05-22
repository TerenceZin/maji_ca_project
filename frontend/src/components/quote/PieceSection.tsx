import { useEffect, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, Cog, Loader2, Package, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import PlanUploadCard from '../piece/PlanUploadCard'
import {
  ExtractPlanResult, PieceIn, PlanFileMeta, PliIn,
  SuggestComponentsResponse, SuggestProductionResponse,
  TrouForme, TrouIn,
} from '../../types'
import api from '../../api'
import NumberInput from '../ui/NumberInput'

interface Props {
  value: PieceIn | null
  onChange: (piece: PieceIn) => void
  quantiteSerie?: number
  onComponentsSuggested?: (response: SuggestComponentsResponse) => void
  onProductionSuggested?: (response: SuggestProductionResponse) => void
}

// ── helpers ──────────────────────────────────────────────────────────────────
interface FormState {
  reference: string; designation: string
  matiere: string; nuance: string; epaisseur_mm: string; traitement: string
  longueur_mm: string; largeur_mm: string; hauteur_mm: string
  surface_dev_m2: string; longueur_decoupe_mm: string; volume_mm3: string; masse_g: string
  tolerances: string; notes: string
  trous: TrouIn[]; plis: PliIn[]
  plan_file_id: number | null
}

const EMPTY: FormState = {
  reference: '', designation: '',
  matiere: '', nuance: '', epaisseur_mm: '', traitement: '',
  longueur_mm: '', largeur_mm: '', hauteur_mm: '',
  surface_dev_m2: '', longueur_decoupe_mm: '', volume_mm3: '', masse_g: '',
  tolerances: '', notes: '',
  trous: [], plis: [], plan_file_id: null,
}

const MATIERES = ['', 'acier', 'inox', 'alu', 'galvanise']
const TRAITEMENTS = ['', 'zingage', 'peinture', 'passivation', 'anodisation', 'grenaillage', 'autre']
const FORMES: TrouForme[] = ['circulaire', 'ovale', 'carré', 'rectangulaire']
const DENSITES: Record<string, number> = { acier: 7.85, inox: 7.93, alu: 2.70, galvanise: 7.85 }

const n2s = (v?: number | null) => (v == null ? '' : String(v))
const s2n = (v: string) => (v === '' ? null : parseFloat(v))

function pieceToForm(p: PieceIn): FormState {
  return {
    reference: p.reference ?? '', designation: p.designation ?? '',
    matiere: p.matiere ?? '', nuance: p.nuance ?? '',
    epaisseur_mm: n2s(p.epaisseur_mm), traitement: p.traitement ?? '',
    longueur_mm: n2s(p.longueur_mm), largeur_mm: n2s(p.largeur_mm), hauteur_mm: n2s(p.hauteur_mm),
    surface_dev_m2: n2s(p.surface_dev_m2), longueur_decoupe_mm: n2s(p.longueur_decoupe_mm),
    volume_mm3: n2s(p.volume_mm3), masse_g: n2s(p.masse_g),
    tolerances: p.tolerances ?? '', notes: p.notes ?? '',
    trous: p.trous ?? [], plis: p.plis ?? [],
    plan_file_id: p.plan_file_id ?? null,
  }
}

function formToPiece(f: FormState): PieceIn {
  return {
    reference: f.reference || null, designation: f.designation || null,
    matiere: f.matiere || null, nuance: f.nuance || null,
    epaisseur_mm: s2n(f.epaisseur_mm), traitement: f.traitement || null,
    longueur_mm: s2n(f.longueur_mm), largeur_mm: s2n(f.largeur_mm), hauteur_mm: s2n(f.hauteur_mm),
    surface_dev_m2: s2n(f.surface_dev_m2), longueur_decoupe_mm: s2n(f.longueur_decoupe_mm),
    volume_mm3: s2n(f.volume_mm3), masse_g: s2n(f.masse_g),
    tolerances: f.tolerances || null, notes: f.notes || null,
    trous: f.trous, plis: f.plis, plan_file_id: f.plan_file_id,
  }
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function PieceSection({ value, onChange, quantiteSerie = 1, onComponentsSuggested, onProductionSuggested }: Props) {
  const [form, setForm] = useState<FormState>(value ? pieceToForm(value) : EMPTY)
  const [planFileMeta, setPlanFileMeta] = useState<PlanFileMeta | null>(null)
  const [open, setOpen] = useState({
    identity: true, matiere: true, dims: true, trous: true, plis: true, notes: false,
  })
  const [loadingComponents, setLoadingComponents] = useState(false)
  const [loadingProduction, setLoadingProduction] = useState(false)
  const [compWarnings, setCompWarnings] = useState<string[]>([])
  const [prodWarnings, setProdWarnings] = useState<string[]>([])

  // Restaure planFileMeta depuis l'API quand le composant remonte avec un plan_file_id existant
  useEffect(() => {
    if (form.plan_file_id && !planFileMeta) {
      api.get<PlanFileMeta>(`/plan-files/${form.plan_file_id}`)
        .then(r => setPlanFileMeta(r.data))
        .catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync vers le parent à chaque changement de form
  useEffect(() => {
    onChange(formToPiece(form))
  }, [form]) // eslint-disable-line react-hooks/exhaustive-deps

  // Surface développée = L × l en m²
  useEffect(() => {
    const l = parseFloat(form.longueur_mm)
    const w = parseFloat(form.largeur_mm)
    if (l > 0 && w > 0)
      setForm(f => ({ ...f, surface_dev_m2: String(+((l * w) / 1_000_000).toFixed(8)).replace(/\.?0+$/, '') || '0' }))
  }, [form.longueur_mm, form.largeur_mm]) // eslint-disable-line react-hooks/exhaustive-deps

  // Volume + Masse : calculés ensemble depuis les dimensions brutes
  // (effet unique pour éviter les problèmes de chaînage d'effets React)
  useEffect(() => {
    const l = parseFloat(form.longueur_mm)
    const w = parseFloat(form.largeur_mm)
    const ep = parseFloat(form.epaisseur_mm)
    if (l > 0 && w > 0 && ep > 0) {
      const vol = +(l * w * ep).toFixed(2)
      const density = DENSITES[form.matiere]
      setForm(f => ({
        ...f,
        volume_mm3: String(vol),
        ...(density ? { masse_g: String(+((vol / 1000) * density).toFixed(1)) } : {}),
      }))
    }
  }, [form.longueur_mm, form.largeur_mm, form.epaisseur_mm, form.matiere]) // eslint-disable-line react-hooks/exhaustive-deps

  // Masse depuis volume saisi manuellement (si l'utilisateur édite volume_mm3 directement)
  useEffect(() => {
    const vol = parseFloat(form.volume_mm3)
    const density = DENSITES[form.matiere]
    if (vol > 0 && density)
      setForm(f => ({ ...f, masse_g: String(+((vol / 1000) * density).toFixed(1)) }))
  }, [form.volume_mm3]) // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (fields: Partial<FormState>) => setForm(f => ({ ...f, ...fields }))
  const f = (key: keyof FormState, val: string) => patch({ [key]: val } as any)

  const handleExtracted = (result: ExtractPlanResult, meta: PlanFileMeta) => {
    setPlanFileMeta(meta)
    patch({
      reference: result.reference ?? form.reference,
      designation: result.designation ?? form.designation,
      matiere: result.matiere ?? form.matiere,
      nuance: result.nuance ?? form.nuance,
      epaisseur_mm: n2s(result.epaisseur_mm) || form.epaisseur_mm,
      traitement: result.traitement ?? form.traitement,
      longueur_mm: n2s(result.longueur_mm) || form.longueur_mm,
      largeur_mm: n2s(result.largeur_mm) || form.largeur_mm,
      hauteur_mm: n2s(result.hauteur_mm) || form.hauteur_mm,
      surface_dev_m2: n2s(result.surface_dev_m2) || form.surface_dev_m2,
      longueur_decoupe_mm: n2s(result.longueur_decoupe_mm) || form.longueur_decoupe_mm,
      volume_mm3: n2s(result.volume_mm3) || form.volume_mm3,
      masse_g: n2s(result.masse_g) || form.masse_g,
      tolerances: result.tolerances ?? form.tolerances,
      notes: result.notes ?? form.notes,
      trous: result.trous?.length ? result.trous : form.trous,
      plis: result.plis?.length ? result.plis : form.plis,
      plan_file_id: meta.id,
    })
    // Ouvre toutes les sections pour que le deviseur voie le résultat
    setOpen({ identity: true, matiere: true, dims: true, trous: true, plis: true, notes: true })
  }

  // ── Suggestions ──
  const buildSuggestBody = () => {
    const p = formToPiece(form)
    return {
      matiere: p.matiere,
      nuance: p.nuance,
      epaisseur_mm: p.epaisseur_mm,
      surface_dev_m2: p.surface_dev_m2,
      masse_g: p.masse_g,
      longueur_decoupe_mm: p.longueur_decoupe_mm,
      notes: p.notes,
      trous: p.trous,
      plis: p.plis,
    }
  }

  const handleSuggestComponents = async () => {
    setLoadingComponents(true)
    setCompWarnings([])
    try {
      const res = await api.post<SuggestComponentsResponse>('/suggestions/components', buildSuggestBody())
      const { components, warnings } = res.data
      setCompWarnings(warnings)
      if (components.length > 0) {
        onComponentsSuggested?.(res.data)
        toast.success(`${components.length} composant(s) suggéré(s) dans la liste`)
      } else {
        toast('Aucun composant trouvé dans le catalogue', { icon: '⚠️' })
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Erreur lors de la suggestion composants')
    } finally {
      setLoadingComponents(false)
    }
  }

  const handleSuggestProduction = async () => {
    setLoadingProduction(true)
    setProdWarnings([])
    try {
      const res = await api.post<SuggestProductionResponse>('/suggestions/production', buildSuggestBody())
      const { production, warnings } = res.data
      setProdWarnings(warnings)
      if (production.length > 0) {
        onProductionSuggested?.(res.data)
        toast.success(`${production.length} ligne(s) de production calculée(s)`)
      } else {
        toast('Aucune ligne de production calculée', { icon: '⚠️' })
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Erreur lors du calcul production')
    } finally {
      setLoadingProduction(false)
    }
  }

  const tog = (s: keyof typeof open) => setOpen(o => ({ ...o, [s]: !o[s] }))

  // ── Formatage masse ──
  const masseUnitaire = parseFloat(form.masse_g) || 0
  const masseTotale = masseUnitaire * (quantiteSerie || 1)
  const fmtMasse = (g: number) => `${g.toFixed(1)} g  (${(g / 1000).toFixed(3)} kg)`

  // ── Mini sous-section ──
  const Sub = ({ label, k, badge, children }: {
    label: string; k: keyof typeof open; badge?: string; children: React.ReactNode
  }) => (
    <div className="border-t border-gray-100">
      <button
        type="button"
        onClick={() => tog(k)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
      >
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
          {label}
          {badge && <span className="normal-case bg-maji-100 text-maji-700 rounded-full px-2 py-0.5">{badge}</span>}
        </span>
        {open[k] ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>
      {open[k] && <div className="px-4 pb-4">{children}</div>}
    </div>
  )

  // ── Input helper ──
  const Input = ({ label, fk, type = 'text', unit, placeholder, note }: {
    label: string; fk: keyof FormState; type?: string; unit?: string; placeholder?: string; note?: string
  }) => (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type={type}
          step={type === 'number' ? 'any' : undefined}
          value={form[fk] as string}
          placeholder={placeholder}
          onChange={e => f(fk, e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
        />
        {unit && <span className="text-xs text-gray-400 shrink-0">{unit}</span>}
      </div>
      {note && <span className="text-xs text-gray-400 mt-0.5 block">{note}</span>}
    </div>
  )

  // ── Trous inline ──
  const updateTrou = (i: number, p: Partial<TrouIn>) =>
    patch({ trous: form.trous.map((r, idx) => idx === i ? { ...r, ...p } : r) })
  const removeTrou = (i: number) => patch({ trous: form.trous.filter((_, idx) => idx !== i) })
  const addTrou = () => patch({ trous: [...form.trous, { forme: 'circulaire', diametre_mm: null, largeur_mm: null, hauteur_mm: null, quantite: 1 }] })

  // ── Plis inline ──
  const updatePli = (i: number, p: Partial<PliIn>) =>
    patch({ plis: form.plis.map((r, idx) => idx === i ? { ...r, ...p } : r) })
  const removePli = (i: number) => patch({ plis: form.plis.filter((_, idx) => idx !== i) })
  const addPli = () => patch({ plis: [...form.plis, { angle_deg: null, rayon_mm: null, longueur_mm: null, quantite: 1 }] })

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* ── En-tête section ── */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800 text-sm">Plan & Pièce</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Déposez un plan pour que Claude pré-remplisse automatiquement les champs, ou saisissez manuellement.
        </p>
      </div>

      {/* ── Upload plan ── */}
      <div className="p-4 border-b border-gray-100">
        <PlanUploadCard
          planFileMeta={planFileMeta}
          onExtracted={handleExtracted}
          onClear={() => { setPlanFileMeta(null); patch({ plan_file_id: null }) }}
        />
      </div>

      {/* ── 1. Identification ── */}
      <Sub label="1. Identification" k="identity">
        <div className="grid grid-cols-2 gap-3 pt-1">
          <Input label="Référence pièce" fk="reference" placeholder="ex. 21597494" />
          <Input label="Désignation" fk="designation" placeholder="ex. SUPPORT REAR BRAKE" />
        </div>
      </Sub>

      {/* ── 2. Matière & Traitement ── */}
      <Sub label="2. Matière & Traitement" k="matiere">
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Matière</label>
            <select value={form.matiere} onChange={e => f('matiere', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500 bg-white">
              {MATIERES.map(m => <option key={m} value={m}>{m || '— non renseigné —'}</option>)}
            </select>
          </div>
          <Input label="Nuance" fk="nuance" placeholder="ex. S235JR, 304, 5754…" />
          <Input label="Épaisseur" fk="epaisseur_mm" type="number" unit="mm" />
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Traitement de surface</label>
            <select value={form.traitement} onChange={e => f('traitement', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500 bg-white">
              {TRAITEMENTS.map(t => <option key={t} value={t}>{t || '— aucun —'}</option>)}
            </select>
          </div>
        </div>
      </Sub>

      {/* ── 3. Dimensions & Masse ── */}
      <Sub label="3. Dimensions & Masse" k="dims">
        <div className="grid grid-cols-3 gap-3 pt-1 mb-3">
          <Input label="Longueur" fk="longueur_mm" type="number" unit="mm" />
          <Input label="Largeur" fk="largeur_mm" type="number" unit="mm" />
          <Input label="Hauteur" fk="hauteur_mm" type="number" unit="mm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Surface développée" fk="surface_dev_m2" type="number" unit="m²" />
          <Input label="Longueur de découpe" fk="longueur_decoupe_mm" type="number" unit="mm" />
          <Input label="Volume" fk="volume_mm3" type="number" unit="mm³" />
          <Input
            label="Masse estimée unitaire"
            fk="masse_g"
            type="number"
            unit="g"
            note={masseUnitaire > 0 ? `(${(masseUnitaire / 1000).toFixed(3)} kg)` : undefined}
          />
          {(quantiteSerie > 1 || masseTotale > 0) && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Masse estimée totale</label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                {masseTotale > 0
                  ? <><span className="font-medium">{masseTotale.toFixed(1)} g</span><span className="text-gray-400 ml-1">({(masseTotale / 1000).toFixed(3)} kg)</span><span className="text-gray-400 ml-2 text-xs">× {quantiteSerie} pcs</span></>
                  : <span className="text-gray-300">—</span>
                }
              </div>
            </div>
          )}
        </div>
      </Sub>

      {/* ── 4. Trous / Découpes ── */}
      <Sub label="4. Trous / Découpes" k="trous" badge={form.trous.length ? String(form.trous.length) : undefined}>
        <div className="pt-1 space-y-1">
          {form.trous.length > 0 && (
            <table className="w-full text-sm mb-2">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-1.5 pr-2 font-medium">Forme</th>
                  <th className="text-left pb-1.5 pr-2 font-medium">Ø mm</th>
                  <th className="text-left pb-1.5 pr-2 font-medium">Larg. mm</th>
                  <th className="text-left pb-1.5 pr-2 font-medium">Haut. mm</th>
                  <th className="text-left pb-1.5 pr-2 font-medium w-16">Qté</th>
                  <th className="pb-1.5 w-6" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {form.trous.map((row, i) => {
                  const circ = row.forme === 'circulaire' || row.forme === 'ovale'
                  const inp = (val: number | null | undefined, cb: (v: number | null) => void, w = 'w-20') => (
                    <NumberInput step={0.001} min={0}
                      value={val}
                      onChange={cb}
                      className={`${w} px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500`}
                    />
                  )
                  return (
                    <tr key={i} className="group">
                      <td className="py-1 pr-2">
                        <select value={row.forme}
                          onChange={e => updateTrou(i, { forme: e.target.value as TrouForme, diametre_mm: null, largeur_mm: null, hauteur_mm: null })}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500 bg-white">
                          {FORMES.map(fo => <option key={fo} value={fo}>{fo}</option>)}
                        </select>
                      </td>
                      <td className="py-1 pr-2">{circ ? inp(row.diametre_mm, v => updateTrou(i, { diametre_mm: v })) : <span className="text-gray-200 text-xs px-2">—</span>}</td>
                      <td className="py-1 pr-2">{!circ ? inp(row.largeur_mm, v => updateTrou(i, { largeur_mm: v })) : <span className="text-gray-200 text-xs px-2">—</span>}</td>
                      <td className="py-1 pr-2">{!circ ? inp(row.hauteur_mm, v => updateTrou(i, { hauteur_mm: v })) : <span className="text-gray-200 text-xs px-2">—</span>}</td>
                      <td className="py-1 pr-2">
                        <NumberInput integer min={1} value={row.quantite}
                          onChange={v => updateTrou(i, { quantite: v ?? 1 })}
                          blurFallback={1}
                          className="w-14 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500" />
                      </td>
                      <td className="py-1">
                        <button onClick={() => removeTrou(i)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-1">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          <button onClick={addTrou} className="flex items-center gap-1.5 text-xs text-maji-600 hover:text-maji-800 font-medium transition-colors">
            <Plus size={13} /> Ajouter un trou / découpe
          </button>
        </div>
      </Sub>

      {/* ── 5. Plis ── */}
      <Sub label="5. Plis" k="plis" badge={form.plis.length ? String(form.plis.length) : undefined}>
        <div className="pt-1 space-y-1">
          {form.plis.length > 0 && (
            <table className="w-full text-sm mb-2">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-1.5 pr-2 font-medium">Angle °</th>
                  <th className="text-left pb-1.5 pr-2 font-medium">Rayon mm</th>
                  <th className="text-left pb-1.5 pr-2 font-medium">Longueur mm</th>
                  <th className="text-left pb-1.5 pr-2 font-medium w-16">Qté</th>
                  <th className="pb-1.5 w-6" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {form.plis.map((row, i) => {
                  const inp = (val: number | null | undefined, cb: (v: number | null) => void, w = 'w-24') => (
                    <NumberInput step="any" min={0}
                      value={val}
                      onChange={cb}
                      className={`${w} px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500`}
                    />
                  )
                  return (
                    <tr key={i} className="group">
                      <td className="py-1 pr-2">{inp(row.angle_deg, v => updatePli(i, { angle_deg: v }), 'w-20')}</td>
                      <td className="py-1 pr-2">{inp(row.rayon_mm, v => updatePli(i, { rayon_mm: v }))}</td>
                      <td className="py-1 pr-2">{inp(row.longueur_mm, v => updatePli(i, { longueur_mm: v }), 'w-28')}</td>
                      <td className="py-1 pr-2">
                        <NumberInput integer min={1} value={row.quantite}
                          onChange={v => updatePli(i, { quantite: v ?? 1 })}
                          blurFallback={1}
                          className="w-14 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500" />
                      </td>
                      <td className="py-1">
                        <button onClick={() => removePli(i)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-1">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          <button onClick={addPli} className="flex items-center gap-1.5 text-xs text-maji-600 hover:text-maji-800 font-medium transition-colors">
            <Plus size={13} /> Ajouter un pli
          </button>
        </div>
      </Sub>

      {/* ── 6. Notes & Tolérances ── */}
      <Sub label="6. Notes & Tolérances" k="notes">
        <div className="grid grid-cols-2 gap-3 pt-1">
          <Input label="Tolérances" fk="tolerances" placeholder="ex. ISO 2768 -m" />
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Notes libres</label>
            <textarea rows={3} value={form.notes}
              onChange={e => f('notes', e.target.value)}
              placeholder="Composants sertis, remarques de fabrication…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500 resize-none" />
          </div>
        </div>
      </Sub>

      {/* ── Actions de suggestion IA ── */}
      <div className="border-t border-gray-100 px-4 py-3 bg-gradient-to-r from-gray-50 to-maji-50">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">Pré-remplissage automatique</p>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleSuggestComponents}
            disabled={loadingComponents}
            className="flex items-center gap-1.5 text-xs bg-maji-600 hover:bg-maji-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-1.5 px-3 rounded-lg font-medium transition-colors"
          >
            {loadingComponents
              ? <Loader2 size={12} className="animate-spin" />
              : <Package size={12} />
            }
            Composants &amp; matières ↓
          </button>
          <button
            type="button"
            onClick={handleSuggestProduction}
            disabled={loadingProduction}
            className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-1.5 px-3 rounded-lg font-medium transition-colors"
          >
            {loadingProduction
              ? <Loader2 size={12} className="animate-spin" />
              : <Cog size={12} />
            }
            Production ↓
          </button>
        </div>

        {/* Warnings composants */}
        {compWarnings.length > 0 && (
          <div className="mt-2 space-y-1">
            {compWarnings.map((w, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                <AlertTriangle size={11} className="mt-0.5 shrink-0 text-amber-500" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Warnings production */}
        {prodWarnings.length > 0 && (
          <div className="mt-2 space-y-1">
            {prodWarnings.map((w, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                <AlertTriangle size={11} className="mt-0.5 shrink-0 text-amber-500" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
