import type { ThemeId } from '../types'

export interface ThemeInfo {
  id: ThemeId
  nom: string
  court: string
  emoji: string
  /** Classes Tailwind statiques (nécessaires pour la génération CSS) */
  gradient: string
  bar: string
}

export const THEMES: ThemeInfo[] = [
  { id: 'bloc1', nom: 'Bloc 1 – Conseiller et vendre', court: 'Vente & SONCAS', emoji: '🗣️', gradient: 'from-violet-500 to-fuchsia-500', bar: 'bg-violet-500' },
  { id: 'bloc2', nom: 'Bloc 2 – Suivre les ventes', court: 'Suivi des ventes', emoji: '🧾', gradient: 'from-sky-500 to-cyan-400', bar: 'bg-sky-500' },
  { id: 'bloc3', nom: 'Bloc 3 – Fidéliser', court: 'Fidélisation & CRM', emoji: '💞', gradient: 'from-pink-500 to-rose-400', bar: 'bg-pink-500' },
  { id: 'prospection', nom: 'Bloc 4B – Prospection', court: 'Prospection & RGPD', emoji: '📞', gradient: 'from-amber-500 to-orange-400', bar: 'bg-amber-500' },
  { id: 'valorisation', nom: "Bloc 4B – Valorisation de l'offre", court: 'Marchandisage', emoji: '🛒', gradient: 'from-emerald-500 to-teal-400', bar: 'bg-emerald-500' },
  { id: 'calculs', nom: 'Calculs commerciaux', court: 'Marge, TVA, remises', emoji: '🧮', gradient: 'from-indigo-500 to-blue-400', bar: 'bg-indigo-500' },
  { id: 'droit', nom: 'Économie-Droit', court: 'Contrats & conso', emoji: '⚖️', gradient: 'from-slate-500 to-slate-400', bar: 'bg-slate-500' },
  { id: 'vocabulaire', nom: 'Vocabulaire commercial', court: 'Définitions clés', emoji: '📖', gradient: 'from-lime-500 to-green-400', bar: 'bg-lime-500' },
]

export const THEME_BY_ID = Object.fromEntries(THEMES.map(t => [t.id, t])) as Record<ThemeId, ThemeInfo>
