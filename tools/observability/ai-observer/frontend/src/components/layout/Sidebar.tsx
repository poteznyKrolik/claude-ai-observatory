import { NavLink } from 'react-router-dom'
import { GitBranch, BarChart3, FileText, BookOpen, ChevronDown, MessageSquare } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import { SidebarDashboards } from './SidebarDashboards'

const insightsItems = [
  { to: '/metrics', icon: BarChart3, label: 'Metrics' },
  { to: '/logs', icon: FileText, label: 'Logs' },
  { to: '/traces', icon: GitBranch, label: 'Traces' },
  { to: '/sessions', icon: MessageSquare, label: 'Sessions' },
]

export function AppSidebar() {
  return (
    <Sidebar collapsible="offcanvas">
      <SidebarContent>
        {/* Dashboards Group */}
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center">
                Dashboards
                <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarDashboards />
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Insights Group */}
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center">
                Insights
                <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {insightsItems.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.to}
                          className={({ isActive }) =>
                            isActive ? 'data-[active=true]' : ''
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <item.icon className="h-4 w-4" />
                              <span>{item.label}</span>
                              <span className="hidden" data-active={isActive} />
                            </>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Documentation Group */}
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center">
                Documentation
                <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/docs"
                        className={({ isActive }) =>
                          isActive ? 'data-[active=true]' : ''
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <BookOpen className="h-4 w-4" />
                            <span>Documentation</span>
                            <span className="hidden" data-active={isActive} />
                          </>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>
    </Sidebar>
  )
}
