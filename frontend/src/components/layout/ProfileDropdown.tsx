import { LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'

const roleLabel: Record<string, string> = {
  ADMIN: 'Administrator',
  SUPERVISOR: 'Supervisor',
  OPERATOR: 'Operator',
}

export function ProfileDropdown({ className }: { className?: string }) {
  const { user, logout } = useAuth()
  const name = user?.name ?? 'User'
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')

  return (
    <div className={cn('relative group', className)}>
      <Button variant="ghost" className="gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initials}
        </div>
        <div className="hidden text-left md:block">
          <div className="text-sm font-medium leading-none">{name}</div>
          <div className="text-xs text-muted-foreground">
            {user ? roleLabel[user.role] : ''}
          </div>
        </div>
      </Button>
      <div className="invisible absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border bg-popover py-1 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
        <div className="flex items-center gap-2 px-3 py-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{user?.email}</span>
        </div>
        <hr className="my-1 border-border" />
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  )
}
