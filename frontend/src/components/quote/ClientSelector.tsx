import { useEffect, useRef, useState } from 'react'
import { Search, Plus, X } from 'lucide-react'
import api from '../../api'
import { Client } from '../../types'
import toast from 'react-hot-toast'

interface Props {
  value: Client | null
  onChange: (client: Client | null) => void
}

export default function ClientSelector({ value, onChange }: Props) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Client[]>([])
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newClient, setNewClient] = useState({ company_name: '', address: '', contact_name: '', contact_email: '', phone: '', siret: '', payment_terms: '30 jours net', default_discount: 0, target_margin: 30 })
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (search.length >= 1) {
      api.get(`/clients?search=${encodeURIComponent(search)}`).then((r) => {
        setResults(r.data)
        setOpen(true)
      })
    } else {
      setResults([])
      setOpen(false)
    }
  }, [search])

  const select = (c: Client) => {
    onChange(c)
    setSearch('')
    setOpen(false)
  }

  const handleCreate = async () => {
    try {
      const res = await api.post('/clients', newClient)
      const full = await api.get(`/clients/${res.data.id}`)
      select(full.data)
      setCreating(false)
      setNewClient({ company_name: '', address: '', contact_name: '', contact_email: '', phone: '', siret: '', payment_terms: '30 jours net', default_discount: 0, target_margin: 30 })
      toast.success('Client créé')
    } catch {
      toast.error('Erreur création client')
    }
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 p-3 bg-maji-50 rounded-lg border border-maji-200">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-maji-900">{value.company_name}</div>
          <div className="text-xs text-maji-600">{value.contact_name} {value.contact_email ? `— ${value.contact_email}` : ''}</div>
        </div>
        <button onClick={() => onChange(null)} className="text-gray-400 hover:text-red-500"><X size={15} /></button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un client…"
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
        />
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
          {results.map((c) => (
            <button key={c.id} onClick={() => select(c)} className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0">
              <div className="font-medium text-sm">{c.company_name}</div>
              <div className="text-xs text-gray-400">{c.contact_name}</div>
            </button>
          ))}
          <button
            onClick={() => { setNewClient((n) => ({ ...n, company_name: search })); setCreating(true); setOpen(false) }}
            className="w-full text-left px-4 py-3 text-maji-600 hover:bg-maji-50 flex items-center gap-2 text-sm font-medium"
          >
            <Plus size={14} /> Créer "{search}"
          </button>
        </div>
      )}

      {creating && (
        <div className="mt-3 p-4 border border-maji-200 rounded-xl bg-maji-50 space-y-3">
          <div className="font-semibold text-sm text-maji-900">Nouveau client</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['company_name', 'Raison sociale *'],
              ['address', 'Adresse'],
              ['contact_name', 'Contact'],
              ['contact_email', 'Email'],
              ['phone', 'Téléphone'],
              ['siret', 'SIRET'],
            ].map(([field, label]) => (
              <div key={field}>
                <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                <input
                  type="text"
                  value={(newClient as any)[field]}
                  onChange={(e) => setNewClient((n) => ({ ...n, [field]: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setCreating(false)} className="btn-secondary text-xs">Annuler</button>
            <button onClick={handleCreate} disabled={!newClient.company_name} className="btn-primary text-xs">Créer le client</button>
          </div>
        </div>
      )}
    </div>
  )
}
