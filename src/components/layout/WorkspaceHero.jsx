import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export function WorkspaceHero({ label, title, description, badge, className, children }) {
  return (
    <section className={cn('relative overflow-hidden border-b bg-zinc-950 text-white', className)}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(225,29,72,0.25),transparent)]" />
      <div className="page-container relative py-10 md:py-14">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-3">
            {label ? (
              <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/15">
                {label}
              </Badge>
            ) : null}
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
            {description ? (
              <p className="text-zinc-400 leading-relaxed">{description}</p>
            ) : null}
          </div>
          {badge ? badge : null}
        </div>
        {children}
      </div>
    </section>
  )
}
