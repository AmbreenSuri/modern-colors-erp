import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Printer, QrCode } from 'lucide-react'
import { api } from '@/lib/api'
import type { Material, Paginated, PurchaseOrder } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/common/EmptyState'
import { toast } from '@/hooks/useToast'

export function LabelsPage() {
  const [params] = useSearchParams()
  const poId = params.get('poId')
  return poId ? <LabelsForPo poId={poId} /> : <RegisteredPoPicker />
}

function RegisteredPoPicker() {
  const [pos, setPos] = useState<PurchaseOrder[]>([])
  useEffect(() => {
    api
      .get<Paginated<PurchaseOrder>>('/purchase-orders?status=REGISTERED&pageSize=50')
      .then((r) => setPos(r.data))
      .catch(() => {})
  }, [])
  if (pos.length === 0)
    return <EmptyState icon={QrCode} title="No registered POs" description="Confirm a PO to generate QR labels." />
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Registered purchase orders:</p>
      {pos.map((p) => (
        <Link
          key={p.id}
          to={`/labels?poId=${p.id}`}
          className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted/50"
        >
          <span className="font-medium">{p.poNumber ?? p.fileName ?? p.id.slice(0, 8)}</span>
          <span className="text-muted-foreground">{p._count?.materials ?? 0} units</span>
        </Link>
      ))}
    </div>
  )
}

function LabelsForPo({ poId }: { poId: string }) {
  const [units, setUnits] = useState<Material[]>([])
  useEffect(() => {
    api
      .get<Paginated<Material>>(`/materials?poId=${poId}&pageSize=500`)
      .then((r) => setUnits(r.data))
      .catch(() => {})
  }, [poId])

  const download = () =>
    api
      .openBlob(`/purchase-orders/${poId}/labels.pdf`)
      .catch(() => toast({ variant: 'destructive', title: 'Could not open labels PDF' }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm">
          <span className="font-medium">{units.length}</span> QR-coded units
        </p>
        <Button onClick={download} className="gap-1.5" disabled={units.length === 0}>
          <Printer className="h-4 w-4" /> Print label sheet (PDF)
        </Button>
      </div>

      {units.length === 0 ? (
        <EmptyState icon={QrCode} title="No units for this PO" />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">S.No</TableHead>
                <TableHead>Unique ID</TableHead>
                <TableHead className="min-w-[180px]">Material</TableHead>
                <TableHead>HSN Code</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((m, i) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-mono text-xs">{m.uniqueId}</TableCell>
                  <TableCell className="whitespace-normal break-words font-medium">{m.materialName}</TableCell>
                  <TableCell className="font-mono text-xs">{m.hsnCode ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{m.sku ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{m.status.replace(/_/g, ' ')}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
