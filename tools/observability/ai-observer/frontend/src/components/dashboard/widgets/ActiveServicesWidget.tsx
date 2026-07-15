import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getServiceDisplayName } from '@/lib/metricMetadata'
import type { StatsResponse } from '@/lib/api'

interface ActiveServicesWidgetProps {
  title: string
  stats: StatsResponse | null
}

export function ActiveServicesWidget({ title, stats }: ActiveServicesWidgetProps) {
  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2">
          {title}
        </CardTitle>
        <CardDescription>Services sending telemetry data</CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="flex flex-wrap gap-2">
          {stats?.services?.length ? (
            stats.services.map((service) => (
              <Badge key={service} variant="secondary">
                {getServiceDisplayName(service)}
              </Badge>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">
              No services detected yet. Configure your AI coding tool to send telemetry to this endpoint.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
