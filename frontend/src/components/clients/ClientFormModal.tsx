import { useState } from 'react'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api'
import { Client } from '../../types'
import NumberInput from '../ui/NumberInput'

interface Props {
  initial?: Client | null
  onClose: () => void
  onSaved: (client: { id: number; company_name: string }) => void
}

type FormState = Omit<Client, 'id' | 'created_at'>

const empty: FormState = {
  company_name: '',
  siret: '',
  address: '',
  phone: '',
  contact_name: '',
  contact_email: '',
  payment_terms: '30 jours net',
  default_discount: 0,
  target_margin: 30,
}

export default function ClientFormModal({ initial, onClose, onSaved }: Props) {
  const isEdit = !!initial
  const [form, setForm] = useState<FormState>(() => initial ? { ...empty, ...initial } : empty)
  const [saving, setSaving] = useState(false)

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.company_name.trim()) {
      toast.error('La raison sociale est obligatoire')
      return
    }
    setSaving(true)
    try {
      const res = isEdit
        ? await api.put(`/clients/${initial!.id}`, form)
        : await api.post('/clients', form)
      toast.success(isEdit ? 'Client mis à jour' : 'Client créé')
      onSaved(res.data)
      onClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const text = (key: keyof FormState, label: string, placeholder = '') => (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <input
        type="text"
        value={(form[key] as string) || ''}
        placeholder={placeholder}
        onChange={(e) => setField(key, e.target.value as any)}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
      />
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">{isEdit ? 'Modifier le client' : 'Nouveau client'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {text('company_name', 'Raison sociale *', 'Ex: Acme SAS')}
          {text('siret', 'SIRET')}
          {text('address', 'Adresse')}
          {text('phone', 'Téléphone')}
          {text('contact_name', 'Contact')}
          {text('contact_email', 'Email contact')}
          {text('payment_terms', 'Conditions de paiement')}
          <div />
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Remise habituelle (%)</label>
            <NumberInput
              min={0}
              max={100}
              value={form.default_discount ?? 0}
              onChange={(v) => setField('default_discount', v ?? 0)}
              blurFallback={0}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Marge cible (%)</label>
            <NumberInput
              min={0}
              max={100}
              value={form.target_margin ?? 30}
              onChange={(v) => setField('target_margin', v ?? 30)}
              blurFallback={30}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-6">
          <button onClick={onClose} className="btn-secondary">Annuler</button>
          <button onClick={handleSave} disabled={saving || !form.company_name.trim()} className="btn-primary">
            {isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  )
}
