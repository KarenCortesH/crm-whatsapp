import { PanelNav } from '@/components/panel/panel-nav'
import { requireUser } from '@/modules/tenancy/session'

export default async function PanelLayout({ children }: LayoutProps<'/panel'>) {
  await requireUser()
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <PanelNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-10">{children}</main>
    </div>
  )
}
