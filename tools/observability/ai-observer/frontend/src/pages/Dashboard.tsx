import { useParams } from 'react-router-dom'
import { DashboardBuilder } from '@/components/dashboard/DashboardBuilder'

export function Dashboard() {
  const { id } = useParams<{ id: string }>()

  // Pass the dashboard ID to the builder
  // If id is undefined, DashboardBuilder will load the default dashboard
  return <DashboardBuilder dashboardId={id} />
}
