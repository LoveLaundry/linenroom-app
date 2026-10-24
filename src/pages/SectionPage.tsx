import type { NavItem } from '../config/app'

/**
 * Placeholder for a screen that is not built yet.
 *
 * It deliberately shows the endpoint the screen will call instead of fake
 * sample data: a mock total on a money screen is indistinguishable from a real
 * one, and someone would eventually act on it.
 */
export function SectionPage({ item }: { item: NavItem }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h1 className="text-lg font-semibold">{item.label}</h1>
      <p className="mt-1 max-w-prose text-sm text-slate-600">{item.blurb}</p>

      <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Screen not built yet
        </p>
        <p className="mt-2 text-sm text-slate-700">
          Will read from{' '}
          <code className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-xs text-white">
            {item.endpoint}
          </code>
        </p>
      </div>
    </section>
  )
}
