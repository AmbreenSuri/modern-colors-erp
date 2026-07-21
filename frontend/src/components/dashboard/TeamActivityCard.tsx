import { Users } from 'lucide-react'
import type { TeamActivityRow } from '@/types/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Per-person activity in the window — the attribution view. Departments SHARE data
 * (PU2 continues PU's batch by design); this card keeps who-did-what individually
 * visible, so shift handover never blurs accountability.
 */
export function TeamActivityCard({
  team,
  title,
  factoryWide = false,
}: {
  team: TeamActivityRow[]
  title: string
  factoryWide?: boolean
}) {
  if (team.length === 0) return null
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-title-3">
          <Users className="h-4 w-4 text-chip-400" /> {title}
          <span className="text-xs font-normal text-chip-500">each login separately, this window</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-label uppercase text-chip-500">
                <th className="pb-2">Person</th>
                <th className="pb-2 text-right">Requests</th>
                <th className="pb-2 text-right">Batches</th>
                <th className="pb-2 text-right">Outputs</th>
                <th className="pb-2 text-right">Confirmed</th>
                {factoryWide && <th className="pb-2 text-right">Dispatched</th>}
                {factoryWide && <th className="pb-2 text-right">Returns</th>}
              </tr>
            </thead>
            <tbody>
              {team.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2">
                    <div className="font-medium">{p.name}</div>
                    <div className="font-mono text-[11px] text-chip-500">{p.email}</div>
                  </td>
                  <td className="py-2 text-right tabular">{p.requestsRaised}</td>
                  <td className="py-2 text-right tabular">{p.batchesCreated}</td>
                  <td className="py-2 text-right tabular">{p.outputsRecorded}</td>
                  <td className="py-2 text-right tabular">{p.outputsConfirmed}</td>
                  {factoryWide && <td className="py-2 text-right tabular">{p.unitsDispatched}</td>}
                  {factoryWide && <td className="py-2 text-right tabular">{p.returnsProcessed}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
