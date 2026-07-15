import { Activity, Wifi, WifiOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ModeToggle } from '@/components/mode-toggle'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'

interface HeaderProps {
  isConnected: boolean
}

export function Header({ isConnected }: HeaderProps) {
  const { isMobile } = useSidebar()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center">
        <div className="flex items-center gap-2 px-4">
          {/* Mobile sidebar trigger */}
          {isMobile && <SidebarTrigger className="-ml-1" />}
          <Activity className="h-6 w-6" />
          <span className="font-bold text-lg">AI Observer</span>
        </div>

        <div className="flex flex-1 items-center justify-end gap-4 px-6">
          <Badge variant={isConnected ? 'success' : 'destructive'} className="flex items-center gap-1">
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3" />
                <span className="hidden sm:inline">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                <span className="hidden sm:inline">Disconnected</span>
              </>
            )}
          </Badge>
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
