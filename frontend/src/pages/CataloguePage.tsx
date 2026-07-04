import { useEffect, useRef, useState } from 'react'
import { Upload, Plus, BookMarked, CheckCircle2, AlertTriangle } from 'lucide-react'
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

interface PreviewRow {
  row: number
  materialName: string | null
  sku: string | null
  hsnCode: string | null
  category: string | null
  unit: string | null
  standardPackaging: string | null
  valid: boolean
  error: string | null
}
interface ImportPreview {
  rows: PreviewRow[]
  totalRows: number
  validRows: number
  invalidRows: number
  detectedColumns: string[]
}
interface ImportResult {
  created: number
  updated: number
  skipped: number
  errors: { row: number; message: string }[]
}

export function CataloguePage() {
  const { hasRole } = useAuth()
  const isAdmin = hasRole('ADMIN')
  const [items, setItems] = useState<CatalogueItem[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [preview, setPreview] = useState<{ file: File; data: ImportPreview } | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
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

  // Step 1: parse + preview (no writes).
  const onPickFile = async (file: File) => {
    setPreviewBusy(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const data = await api.postForm<ImportPreview>('/catalogue/import/preview', form)
      setPreview({ file, data })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Could not read file',
        description: err instanceof ApiError ? err.message : 'Unexpected error',
      })
    } finally {
      setPreviewBusy(false)
    }
  }

  // Step 2: commit the import after the operator reviews the preview.
  const confirmImport = async () => {
    if (!preview) return
    setPreviewBusy(true)
    try {
      const form = new FormData()
      form.append('file', preview.file)
      const r = await api.postForm<ImportResult>('/catalogue/import', form)
      const failed = r.errors.length
      toast({
        title: 'Catalogue imported',
        description:
          `${r.created} created, ${r.updated} updated` +
          (r.skipped ? `, ${r.skipped} skipped` : '') +
          (failed ? ` — ${failed} row(s) failed` : '') + '.',
      })
      setPreview(null)
      await load()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Import failed',
        description: err instanceof ApiError ? err.message : 'Unexpected error',
      })
    } finally {
      setPreviewBusy(false)
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
                  if (f) onPickFile(f)
                  e.target.value = ''
                }}
              />
              <Button className="gap-1.5" onClick={() => fileInput.current?.click()} disabled={previewBusy}>
                <Upload className="h-4 w-4" /> {previewBusy ? 'Reading…' : 'Import CSV/Excel'}
              </Button>
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{total} SKUs</p>

      {items.length === 0 ? (
        <EmptyState icon={BookMarked} title="No catalogue items" description="Import a CSV/Excel master list or add SKUs manually." />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Material</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>HSN Code</TableHead>
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
                  <TableCell className="font-mono text-xs">{it.hsnCode ?? '—'}</TableCell>
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
      <ImportPreviewModal
        preview={preview?.data ?? null}
        busy={previewBusy}
        onCancel={() => setPreview(null)}
        onConfirm={confirmImport}
      />
    </div>
  )
}

function ImportPreviewModal({
  preview,
  busy,
  onCancel,
  onConfirm,
}: {
  preview: ImportPreview | null
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!preview) return null
  return (
    <Modal open onOpenChange={(o) => !o && onCancel()} title="Review import">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="inline-flex items-center gap-1 text-success">
            <CheckCircle2 className="h-4 w-4" /> {preview.validRows} valid
          </span>
          {preview.invalidRows > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-600">
              <AlertTriangle className="h-4 w-4" /> {preview.invalidRows} will be skipped
            </span>
          )}
          <span className="text-muted-foreground">{preview.totalRows} rows total</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Detected columns: {preview.detectedColumns.length ? preview.detectedColumns.join(', ') : 'none recognized'}
        </p>

        <div className="max-h-[50vh] overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead className="min-w-[150px]">Material</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>HSN</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.rows.slice(0, 200).map((r) => (
                <TableRow key={r.row} className={r.valid ? '' : 'bg-amber-500/5'}>
                  <TableCell className="text-xs text-muted-foreground">{r.row}</TableCell>
                  <TableCell className="font-medium">{r.materialName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="font-mono text-xs">{r.sku ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{r.hsnCode ?? '—'}</TableCell>
                  <TableCell className="text-xs">{r.category ?? '—'}</TableCell>
                  <TableCell className="text-xs">{r.unit ?? '—'}</TableCell>
                  <TableCell className="text-xs">
                    {r.valid ? (
                      <span className="text-success">OK</span>
                    ) : (
                      <span className="text-amber-600">{r.error}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {preview.rows.length > 200 && (
          <p className="text-xs text-muted-foreground">Showing first 200 of {preview.rows.length} rows.</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={busy || preview.validRows === 0}>
            {busy ? 'Importing…' : `Import ${preview.validRows} row${preview.validRows === 1 ? '' : 's'}`}
          </Button>
        </div>
      </div>
    </Modal>
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
  const [form, setForm] = useState({ materialName: '', sku: '', hsnCode: '', category: '', unit: '', standardPackaging: '' })
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
        hsnCode: form.hsnCode.trim() || undefined,
        category: form.category.trim() || undefined,
        unit: form.unit.trim() || undefined,
        standardPackaging: form.standardPackaging.trim() || undefined,
      })
      toast({ title: 'SKU added' })
      setForm({ materialName: '', sku: '', hsnCode: '', category: '', unit: '', standardPackaging: '' })
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
            ['hsnCode', 'HSN code'],
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
