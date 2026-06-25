import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NotificationBell } from './NotificationBell'
import { ProfileDropdown } from './ProfileDropdown'

interface NavbarProps {
  title: string
  subtitle?: string
  onMenuClick?: () => void
}

export function Navbar({ title, subtitle, onMenuClick }: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0 lg:hidden"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold leading-none">{title}</h1>
          {subtitle && (
            <p className="mt-0.5 hidden truncate text-xs text-muted-foreground sm:block">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <NotificationBell />
        <ProfileDropdown />
      </div>
    </header>
  )
}
