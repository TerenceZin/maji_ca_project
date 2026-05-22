import { useState } from 'react'
import { X } from 'lucide-react'
import api from '../../api'
import { QuoteData } from '../../types'
import toast from 'react-hot-toast'

interface Props {
  data: QuoteData
  clientId?: number
  onClose: () => void
}

export default function SaveTemplateModal({ data, clientId, onClose }: Props) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'client' | 'product' | 'combined'>('product')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await api.post('/templates', { name, type, client_id: clientId || null, data })
      toast.success('Template sauvegardé')
      onClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Erreur sauvegarde template')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Sauvegarder comme template</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nom du template</label>
            <input autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Boîtier standard inox" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as any)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500">
              <option value="product">Produit (nomenclature + production)</option>
              <option value="client">Client (conditions commerciales)</option>
              <option value="combined">Combiné (client + produit)</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={onClose} className="btn-secondary">Annuler</button>
            <button onClick={handleSave} disabled={!name.trim() || saving} className="btn-primary">Sauvegarder</button>
          </div>
        </div>
      </div>
    </div>
  )
}
