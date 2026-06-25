import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileUp, FileText } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import type { Paginated, PurchaseOrder, POStatus } from '@/types/api'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/common/EmptyState'
import { toast } from '@/hooks/useToast'

const STATUS_STYLE: Record<POStatus, { label: string; variant?: 'default' | 'secondary' | 'outline' }> = {
  PO_UPLOADED: { label: 'Uploaded', variant: 'secondary' },
  AI_EXTRACTED: { label: 'Needs review', variant: 'outline' },
  OPERATOR_VERIFIED: { label: 'Verified', variant: 'default' },
  REGISTERED: { label: 'Registered', variant: 'default' },
}

export function PurchaseOrdersPage() {
  const nav = useNavigate()
  const { hasRole } = useAuth()
  const canUpload = hasRole('ADMIN', 'OPERATOR')
  const [pos, setPos] = useState<PurchaseOrder[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = () =>
    api.get<Paginated<PurchaseOrder>>('/purchase-orders?pageSize=50').then((r) => setPos(r.data)).catch(() => {})
  useEffect(() => void load(), [])

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const po = await api.postForm<PurchaseOrder>('/purchase-orders', form)
      toast({ title: 'PO uploaded', description: 'Run extraction or enter details on the review screen.' })
      nav(`/review/${po.id}`)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: err instanceof ApiError ? err.message : 'Unexpected error',
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-5">
      {canUpload && (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const f = e.dataTransfer.files?.[0]
            if (f) upload(f)
          }}
        >
          <div className="rounded-full bg-muted p-3">
            <FileUp className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">Upload a Purchase Order</p>
            <p className="text-xs text-muted-foreground">PDF, image, or scan — drag &amp; drop or browse</p>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) upload(f)
              e.target.value = ''
            }}
          />
          <Button onClick={() => fileInput.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading…' : 'Choose file'}
          </Button>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold">Recent purchase orders</h2>
        {pos.length === 0 ? (
          <EmptyState icon={FileText} title="No purchase orders yet" />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Lines</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pos.map((po) => {
                  const s = STATUS_STYLE[po.status]
                  return (
                    <TableRow key={po.id}>
                      <TableCell className="font-medium">{po.poNumber ?? '—'}</TableCell>
                      <TableCell>{po.supplier ?? '—'}</TableCell>
                      <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">
                        {po.fileName ?? '—'}
                      </TableCell>
                      <TableCell>{po._count?.lineItems ?? 0}</TableCell>
                      <TableCell>{po._count?.materials ?? 0}</TableCell>
                      <TableCell>
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            nav(po.status === 'REGISTERED' ? `/labels?poId=${po.id}` : `/review/${po.id}`)
                          }
                        >
                          {po.status === 'REGISTERED' ? 'Labels' : 'Open'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
