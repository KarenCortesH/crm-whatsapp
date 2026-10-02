'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/panel', label: 'Salud', icon: '❤️' },
  { href: '/panel/bandeja', label: 'Bandeja', icon: '💬' },
  { href: '/panel/plantillas', label: 'Plantillas', icon: '📝' },
  { href: '/panel/campanas', label: 'Campañas', icon: '📣' },
  { href: '/panel/contactos', label: 'Contactos', icon: '👥' },
  { href: '/panel/consumo', label: 'Consumo', icon: '💲' },
  { href: '/panel/conectar', label: 'Número', icon: '🔌' },
]

export function PanelNav() {
  const pathname = usePathname()
  const isActive = (href: string) => (href === '/panel' ? pathname === '/panel' : pathname.startsWith(href))

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white md:static md:w-56 md:shrink-0 md:border-r md:border-t-0"
    >
      <p className="hidden px-5 py-5 text-lg font-bold text-teal-800 md:block">Canal Seguro</p>
      <ul className="flex overflow-x-auto md:flex-col md:overflow-visible">
        {ITEMS.map((item) => (
          <li key={item.href} className="flex-1 md:flex-none">
            <Link
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={`flex min-w-16 flex-col items-center gap-0.5 px-2 py-2 text-xs md:flex-row md:gap-3 md:px-5 md:py-2.5 md:text-sm ${
                isActive(item.href) ? 'font-semibold text-teal-800 md:bg-teal-50' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span aria-hidden className="text-lg md:text-base">{item.icon}</span>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
