import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Save, FileDown, Send, ShieldCheck, Eye, BookmarkPlus,
  Plus, Trash2, Sparkles, Loader2, ChevronDown, ChevronUp, ArrowLeft,
} from 'lucide-react'
import api from '../api'
import { CatalogItem, Client, Quote, QuoteComponent, QuoteData, QuoteProductionLine, QuoteTransport, SuggestComponentsResponse, SuggestProductionResponse } from '../types'
import { useAuthStore } from '../store/auth'
import ClientSelector from '../components/quote/ClientSelector'
import ComponentsTable from '../components/quote/ComponentsTable'
import ProductionSection from '../components/quote/ProductionSection'
import TransportSection from '../components/quote/TransportSection'
import CsvEditor from '../components/quote/CsvEditor'
import SummaryBar from '../components/quote/SummaryBar'
import SaveTemplateModal from '../components/quote/SaveTemplateModal'
import ProductSearch from '../components/quote/ProductSearch'
import PieceSection from '../components/quote/PieceSection'
import SendEmailModal from '../components/quote/SendEmailModal'
import NumberInput from '../components/ui/NumberInput'

const PIECE_UNIT_RX = /^(pcs?|pi[èe]ces?|unit[ée]s?|u)$/i
const isPieceUnit = (unit?: string) => !!unit && PIECE_UNIT_RX.test(unit.trim())

const EMPTY_DATA: QuoteData = {
  components: [],
  production: [],
  transport: { mode: 'routier', carrier_id: undefined, carrier_name: undefined, weight_net_g: 0, weight_packaging_g: 0, weight_gross_g: 0, dimensions: '', volumetric_weight_g: 0, zone: '', cost: 0 },
  subtotal: 0,
  margin_amount: 0,
  quantity_serie: 1,
}

export default function QuoteEditorPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [quote, setQuote] = useState<Partial<Quote>>({ status: 'draft', margin_percent: 30, total_ht: 0, total_ttc: 0 })
  const [data, setData] = useState<QuoteData>(EMPTY_DATA)
  const [client, setClient] = useState<Client | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!isNew)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [openSections, setOpenSections] = useState({ piece: true, components: true, production: true, transport: true, csv: false })
  const rescaleBaselineRef = useRef<{ qty: number; components: QuoteComponent[]; production: QuoteProductionLine[] } | null>(null)

  // Load quote if editing
  useEffect(() => {
    if (!isNew) {
      api.get(`/quotes/${id}`).then((r) => {
        const q: Quote = r.data
        setQuote(q)
        setData(q.data && Object.keys(q.data).length > 0 ? q.data : EMPTY_DATA)
        if (q.client_id) {
          api.get(`/clients/${q.client_id}`).then((cr) => setClient(cr.data)).catch(() => {})
        }
      }).catch(() => toast.error('Devis introuvable')).finally(() => setLoading(false))
    }
  }, [id, isNew])

  // Recalculate totals
  const recalculate = useCallback((d: QuoteData, margin: number) => {
    const compTotal = d.components.reduce((s, c) => s + (c.total || 0), 0)
    const prodTotal = d.production.reduce((s, p) => s + (p.cost || 0), 0)
    const transportCost = d.transport?.cost || 0
    const subtotal = compTotal + prodTotal + transportCost
    const marginAmount = subtotal * (margin / 100)
    const totalHt = subtotal + marginAmount
    const totalTtc = totalHt * 1.2
    return [{ ...d, subtotal, margin_amount: marginAmount }, totalHt, totalTtc] as [QuoteData, number, number]
  }, [])

  const updateData = (patch: Partial<QuoteData>) => {
    setData((prev) => {
      const next = { ...prev, ...patch }
      const [calcData, ht, ttc] = recalculate(next, quote.margin_percent || 30)
      setQuote((q) => ({ ...q, total_ht: ht, total_ttc: ttc, data: calcData }))
      return calcData
    })
  }

  const updateMargin = (margin: number) => {
    setQuote((q) => {
      const [, ht, ttc] = recalculate(data, margin)
      return { ...q, margin_percent: margin, total_ht: ht, total_ttc: ttc }
    })
  }

  const handleSave = async (status?: string) => {
    setSaving(true)
    try {
      const [calcData, ht, ttc] = recalculate(data, quote.margin_percent || 30)
      const payload = {
        client_id: client?.id || quote.client_id,
        data: calcData,
        margin_percent: quote.margin_percent || 30,
        total_ht: ht,
        total_ttc: ttc,
        status: status || quote.status || 'draft',
        estimated_delivery_date: quote.estimated_delivery_date,
      }
      let res
      if (isNew) {
        res = await api.post('/quotes', payload)
        toast.success(`Devis ${res.data.reference} créé`)
        navigate(`/quotes/${res.data.id}`, { replace: true })
      } else {
        res = await api.put(`/quotes/${id}`, payload)
        setQuote(res.data)
        toast.success('Devis sauvegardé')
      }
    } catch {
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    await handleSave('draft')
    try {
      const res = await api.post(`/quotes/${isNew ? quote.id : id}/submit`)
      toast.success(res.data.status === 'submitted' ? 'Devis soumis pour validation' : 'Devis envoyé au client')
      setQuote((q) => ({ ...q, status: res.data.status }))
    } catch {
      toast.error('Erreur lors de la soumission')
    }
  }

  const handleSendEmail = async (email: string, message: string) => {
    await api.post(`/quotes/${id}/send-email`, { email, message })
    setQuote((q) => ({ ...q, status: 'sent' }))
    setShowEmailModal(false)
    toast.success(`Devis envoyé à ${email}`)
  }

  const handleDelete = async () => {
    if (!confirm('Supprimer ce devis ? Cette action est irréversible.')) return
    try {
      await api.delete(`/quotes/${id}`)
      toast.success('Devis supprimé')
      navigate('/dashboard', { replace: true })
    } catch {
      toast.error('Impossible de supprimer ce devis')
    }
  }

  const toggle = (section: keyof typeof openSections) =>
    setOpenSections((s) => ({ ...s, [section]: !s[section] }))

  // ── Callbacks de suggestion IA ──
  const handleComponentsSuggested = (response: SuggestComponentsResponse) => {
    const newComponents: QuoteComponent[] = response.components.map((c) => ({
      reference: c.reference,
      name: c.name,
      supplier: c.supplier,
      quantity: c.quantity,
      unit: c.unit,
      unit_price: c.unit_price,
      total: c.total,
      weight_g: c.weight_g ?? undefined,
      price_change_flag: c.price_change_flag ?? undefined,
    }))
    updateData({ components: newComponents })
    setOpenSections((s) => ({ ...s, components: true }))
  }

  const handleProductionSuggested = (response: SuggestProductionResponse) => {
    const newProduction: QuoteProductionLine[] = response.production.map((p) => ({
      operation_type: p.operation_type,
      operation_name: p.operation_name,
      machine_id: p.machine_id ?? undefined,
      machine_name: p.machine_name ?? undefined,
      quantity: p.quantity,
      unit_of_measure: p.unit_of_measure,
      material: p.material,
      thickness_mm: p.thickness_mm,
      complexity_factor: p.complexity_factor,
      time_min: p.time_min,
      hourly_cost: p.hourly_cost,
      cost: p.cost,
      estimated_delivery: p.estimated_delivery ?? undefined,
    }))
    updateData({ production: newProduction })
    setOpenSections((s) => ({ ...s, production: true }))
  }

  if (loading) return <div className="p-8 text-gray-400">Chargement du devis…</div>

  const canSend = (quote.total_ht || 0) <= 10000 || quote.status === 'validated'
  const needsValidation = (quote.total_ht || 0) > 10000 && quote.status === 'draft'

  const SectionHeader = ({ title, section, children }: { title: string; section: keyof typeof openSections; children?: React.ReactNode }) => (
    <div
      className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 cursor-pointer select-none"
      onClick={() => toggle(section)}
    >
      <h3 className="font-semibold text-gray-800">{title}</h3>
      <div className="flex items-center gap-2">
        {children}
        {openSections[section] ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Top action bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            title="Retour aux devis"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="font-bold text-gray-900">{quote.reference || 'Nouveau devis'}</div>
            <div className="text-xs text-gray-400">{quote.status ? STATUS_LABELS[quote.status] || quote.status : 'Brouillon'}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isNew && ['draft', 'submitted'].includes(quote.status || '') && (
            <button onClick={handleDelete} className="btn-secondary gap-1.5 text-red-500 hover:bg-red-50 hover:border-red-200">
              <Trash2 size={15} /> Supprimer
            </button>
          )}
          <button onClick={() => setShowTemplateModal(true)} className="btn-secondary gap-1.5"><BookmarkPlus size={15} /> Template</button>
          <button onClick={() => handleSave()} disabled={saving} className="btn-secondary gap-1.5">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Sauvegarder
          </button>
          {!isNew && <button onClick={() => navigate(`/quotes/${id}/pdf`)} className="btn-secondary gap-1.5"><Eye size={15} /> PDF</button>}
          {canSend ? (
            <button
              onClick={() => !isNew ? setShowEmailModal(true) : handleSave('sent')}
              className="btn-primary gap-1.5"
            >
              <Send size={15} /> Envoyer client
            </button>
          ) : needsValidation ? (
            <button onClick={handleSubmit} className="btn-primary gap-1.5"><ShieldCheck size={15} /> Soumettre validation</button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-28">
        <div className="max-w-5xl mx-auto p-4 space-y-4">

          {/* Plan & Pièce */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <SectionHeader title="Plan & Pièce" section="piece">
              {data.piece?.designation && (
                <span className="text-xs text-maji-600 font-medium truncate max-w-xs">{data.piece.designation}</span>
              )}
            </SectionHeader>
            {openSections.piece && (
              <PieceSection
                value={data.piece ?? null}
                onChange={(piece) => updateData({ piece })}
                quantiteSerie={data.quantity_serie || 1}
                onComponentsSuggested={handleComponentsSuggested}
                onProductionSuggested={handleProductionSuggested}
              />
            )}
          </div>

          {/* Header section */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide text-gray-500">En-tête</h3>
            <ClientSelector
              value={client}
              onChange={(c) => { setClient(c); setQuote((q) => ({ ...q, client_id: c?.id })) }}
            />
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Rechercher un produit Maji</label>
              <ProductSearch quantity={data.quantity_serie || 1} onApply={(patch) => updateData(patch)} />
              <p className="text-xs text-gray-400 mt-1">Sélectionnez un produit et une quantité pour pré-remplir composants, production et transport.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Référence</label>
                <div className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500">{quote.reference || 'Auto-généré à la création'}</div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Date de livraison estimée</label>
                <input
                  type="date"
                  value={quote.estimated_delivery_date || ''}
                  onChange={(e) => setQuote((q) => ({ ...q, estimated_delivery_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
                />
              </div>
            </div>
          </div>

          {/* Components */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <SectionHeader title="Composants et matières premières" section="components" />
            {openSections.components && (
              <ComponentsTable
                rows={data.components}
                onChange={(components) => updateData({ components })}
              />
            )}
          </div>

          {/* Production */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <SectionHeader title="Production" section="production" />
            {openSections.production && (
              <ProductionSection
                rows={data.production}
                onChange={(production) => updateData({ production })}
                estimatedDelivery={quote.estimated_delivery_date}
              />
            )}
          </div>

          {/* Quantité de série */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500 mb-3">Quantité de série</h3>
            <div className="flex items-center gap-3">
              <NumberInput
                integer
                min={1}
                blurFallback={1}
                value={data.quantity_serie ?? 1}
                onFocus={() => {
                  rescaleBaselineRef.current = {
                    qty: Math.max(data.quantity_serie || 1, 1),
                    components: data.components.map((c) => ({ ...c })),
                    production: data.production.map((p) => ({ ...p })),
                  }
                }}
                onChange={(v) => {
                  // Intermediate keystrokes : mettre à jour la valeur affichée sans rescale.
                  if (v == null) return
                  updateData({ quantity_serie: v })
                }}
                onCommit={(v) => {
                  const baseline = rescaleBaselineRef.current
                  rescaleBaselineRef.current = null
                  const newQty = Math.max(v ?? 1, 1)
                  if (!baseline || newQty === baseline.qty || baseline.qty <= 0) {
                    if (newQty !== (data.quantity_serie ?? 1)) updateData({ quantity_serie: newQty })
                    return
                  }
                  const ratio = newQty / baseline.qty
                  const components = baseline.components.map((c) => {
                    const rescaled = c.quantity * ratio
                    const qty = isPieceUnit(c.unit)
                      ? Math.max(1, Math.round(rescaled))
                      : parseFloat(rescaled.toFixed(4))
                    return { ...c, quantity: qty, total: parseFloat((qty * c.unit_price).toFixed(4)) }
                  })
                  const production = baseline.production.map((p) => ({
                    ...p,
                    quantity: parseFloat((p.quantity * ratio).toFixed(4)),
                    time_min: parseFloat((p.time_min * ratio).toFixed(2)),
                    cost: parseFloat((p.cost * ratio).toFixed(2)),
                  }))
                  updateData({ quantity_serie: newQty, components, production })
                }}
                className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500 text-center"
              />
              <span className="text-sm text-gray-500">pièce(s) à fabriquer</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">Le rescale des composants, matières et production s'applique à la validation (Tab ou clic ailleurs). Les composants comptés en pièces sont arrondis à l'entier.</p>
          </div>

          {/* Transport */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <SectionHeader title="Transport" section="transport" />
            {openSections.transport && (
              <TransportSection
                value={data.transport}
                onChange={(transport) => updateData({ transport })}
                netWeightG={data.components.reduce((s, c) => s + ((c.weight_g || 0) * c.quantity), 0)}
                piece={data.piece}
                quantitySerie={data.quantity_serie || 1}
              />
            )}
          </div>

          {/* CSV editor */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <SectionHeader title="Éditeur consolidé (CSV)" section="csv" />
            {openSections.csv && (
              <CsvEditor data={data} onChange={(d) => updateData(d)} />
            )}
          </div>
        </div>
      </div>

      {/* Sticky summary */}
      <SummaryBar
        data={data}
        marginPercent={quote.margin_percent || 30}
        totalHt={quote.total_ht || 0}
        totalTtc={quote.total_ttc || 0}
        onMarginChange={updateMargin}
      />

      {showTemplateModal && (
        <SaveTemplateModal
          data={data}
          clientId={client?.id}
          onClose={() => setShowTemplateModal(false)}
        />
      )}

      {showEmailModal && (
        <SendEmailModal
          quoteRef={quote.reference || ''}
          clientEmail={client?.contact_email || ''}
          onSend={handleSendEmail}
          onClose={() => setShowEmailModal(false)}
        />
      )}
    </div>
  )
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon', submitted: 'En attente validation', validated: 'Validé',
  sent: 'Envoyé', accepted: 'Accepté', refused: 'Refusé', refused_client: 'Refusé client',
}
