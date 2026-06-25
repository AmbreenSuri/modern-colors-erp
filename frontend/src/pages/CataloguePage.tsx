import { useEffect, useRef, useState } from 'react'
import { Upload, Plus, BookMarked } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import type { CatalogueItem, Paginated } from '@/types/api'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Modal } from '@/components/common/Modal'
import { EmptyState } from '@/components/common/EmptyState'
import { toast } from '@/hooks/useToast'

export function CataloguePage() {
  const { hasRole } = useAuth()
  const isAdmin = hasRole('ADMIN')
  const [items, setItems] = useState<CatalogueItem[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = (q = search) =>
    api
      .get<Paginated<CatalogueItem>>(`/catalogue?pageSize=200&search=${encodeURIComponent(q)}`)
      .then((r) => {
        setItems(r.data)
        setTotal(r.total)
      })
      .catch(() => {})
  useEffect(() => void load(''), [])

  const onImport = async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    try {
      const r = await api.postForm<{ created: number; updated: number; skipped: number }>(
        '/catalogue/import',
        form,
      )
      toast({
        title: 'Catalogue imported',
        description: `${r.created} created, ${r.updated} updated, ${r.skipped} skipped.`,
      })
      await load()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Import failed',
        description: err instanceof ApiError ? err.message : 'Unexpected error',
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search material / SKU / category…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            load(e.target.value)
          }}
          className="max-w-xs"
        />
        <div className="ml-auto flex gap-2">
          <Button variant="outline" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add SKU
          </Button>
          {isAdmin && (
            <>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onImport(f)
                  e.target.value = ''
                }}
              />
              <Button className="gap-1.5" onClick={() => fileInput.current?.click()}>
                <Upload className="h-4 w-4" /> Import CSV/Excel
              </Button>
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{total} SKUs</p>

      {items.length === 0 ? (
        <EmptyState icon={BookMarked} title="No catalogue items" description="Import a CSV/Excel master list or add SKUs manually." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Packaging</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">{it.materialName}</TableCell>
                  <TableCell className="font-mono text-xs">{it.sku}</TableCell>
                  <TableCell>{it.category ?? '—'}</TableCell>
                  <TableCell>{it.unit ?? '—'}</TableCell>
                  <TableCell>{it.standardPackaging ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AddSkuModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={() => load()} />
    </div>
  )
}

function AddSkuModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean
  onClose: () => void
  onAdded: () => void
}) {
  const [form, setForm] = useState({ materialName: '', sku: '', category: '', unit: '', standardPackaging: '' })
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value })

  const submit = async () => {
    if (!form.materialName.trim()) return
    setBusy(true)
    try {
      await api.post('/catalogue', {
        materialName: form.materialName.trim(),
        sku: form.sku.trim() || undefined,
        category: form.category.trim() || undefined,
        unit: form.unit.trim() || undefined,
        standardPackaging: form.standardPackaging.trim() || undefined,
      })
      toast({ title: 'SKU added' })
      setForm({ materialName: '', sku: '', category: '', unit: '', standardPackaging: '' })
      onAdded()
      onClose()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Could not add SKU',
        description: err instanceof ApiError ? err.message : 'Unexpected error',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="Add a new SKU">
      <div className="space-y-3">
        {(
          [
            ['materialName', 'Material name *'],
            ['sku', 'SKU (optional — auto-generated if blank)'],
            ['category', 'Category'],
            ['unit', 'Unit'],
            ['standardPackaging', 'Standard packaging'],
          ] as const
        ).map(([k, label]) => (
          <div key={k} className="space-y-1.5">
            <Label htmlFor={k}>{label}</Label>
            <Input id={k} value={form[k]} onChange={set(k)} />
          </div>
        ))}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !form.materialName.trim()}>
            {busy ? 'Adding…' : 'Add SKU'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
