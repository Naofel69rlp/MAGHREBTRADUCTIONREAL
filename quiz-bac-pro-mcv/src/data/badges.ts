import type { Profile, ThemeId } from '../types'
import { THEMES } from './themes'
import { levelOf } from './levels'

export interface BadgeDef {
  id: string
  nom: string
  emoji: string
  desc: string
  test: (p: Profile) => boolean
}

/** Thème « maîtrisé » : au moins 20 réponses données et 80 % de réussite. */
export function isMastered(p: Profile, theme: ThemeId): boolean {
  const s = p.byTheme[theme]
  return s.answered >= 20 && s.correct / s.answered >= 0.8
}

const masteryBadges: BadgeDef[] = THEMES.map(t => ({
  id: `maitre-${t.id}`,
  nom: `Maître : ${t.court}`,
  emoji: t.emoji,
  desc: `Réponds à 20 questions « ${t.court} » avec au moins 80 % de réussite.`,
  test: p => isMastered(p, t.id),
}))

export const BADGES: BadgeDef[] = [
  { id: 'premiers-pas', nom: 'Premiers pas', emoji: '👣', desc: 'Termine ta première partie.', test: p => p.counters.games >= 1 },
  { id: 'habitue', nom: 'Habitué', emoji: '🎮', desc: 'Termine 10 parties.', test: p => p.counters.games >= 10 },
  { id: 'accro', nom: 'Accro au quiz', emoji: '🤩', desc: 'Termine 50 parties.', test: p => p.counters.games >= 50 },
  { id: 'cent', nom: 'Centenaire', emoji: '💯', desc: 'Réponds à 100 questions.', test: p => p.answered >= 100 },
  { id: 'erudit', nom: 'Érudit', emoji: '🎓', desc: 'Réponds à 500 questions.', test: p => p.answered >= 500 },
  { id: 'sans-faute', nom: 'Sans faute', emoji: '✨', desc: 'Termine une partie de 5 questions ou plus sans aucune erreur.', test: p => p.counters.perfect >= 1 },
  { id: 'soncas', nom: 'Roi du SONCAS', emoji: '🧠', desc: 'Réussis 15 questions sur les mobiles d\'achat SONCAS.', test: p => p.counters.soncas >= 15 },
  { id: 'calculatrice', nom: 'Calculatrice humaine', emoji: '🧮', desc: 'Réussis 20 calculs commerciaux.', test: p => p.counters.calc >= 20 },
  { id: 'noctambule', nom: 'Noctambule', emoji: '🦉', desc: 'Joue une partie entre minuit et 5 h du matin.', test: p => p.counters.night >= 1 },
  { id: 'leve-tot', nom: 'Lève-tôt', emoji: '🌅', desc: 'Joue une partie entre 5 h et 7 h du matin.', test: p => p.counters.early >= 1 },
  { id: 'serie-3', nom: '3 jours d\'affilée', emoji: '🔥', desc: 'Atteins une série de 3 jours.', test: p => p.streak.best >= 3 },
  { id: 'serie-7', nom: '7 jours d\'affilée', emoji: '📅', desc: 'Atteins une série de 7 jours.', test: p => p.streak.best >= 7 },
  { id: 'serie-30', nom: 'Un mois de flamme', emoji: '🌋', desc: 'Atteins une série de 30 jours.', test: p => p.streak.best >= 30 },
  { id: 'combo-5', nom: 'En rythme', emoji: '⚡', desc: 'Enchaîne 5 bonnes réponses d\'affilée.', test: p => p.counters.bestCombo >= 5 },
  { id: 'combo-10', nom: 'Inarrêtable', emoji: '🚀', desc: 'Enchaîne 10 bonnes réponses d\'affilée.', test: p => p.counters.bestCombo >= 10 },
  { id: 'eclair', nom: 'Éclair', emoji: '⏱️', desc: 'Réponds juste en moins de 2,5 secondes, 10 fois.', test: p => p.counters.fast >= 10 },
  { id: 'chrono', nom: 'Maître du chrono', emoji: '⏳', desc: 'Réussis 15 questions ou plus en mode Contre-la-montre.', test: p => p.counters.chrono >= 15 },
  { id: 'survivant', nom: 'Survivant', emoji: '🛡️', desc: 'Réussis 15 questions ou plus en mode Survie.', test: p => p.counters.survie >= 15 },
  { id: 'defi', nom: 'Défi relevé', emoji: '📆', desc: 'Termine un Défi du jour.', test: p => p.counters.dailyDone >= 1 },
  { id: 'defi-parfait', nom: 'Défi parfait', emoji: '🎯', desc: 'Réussis un Défi du jour sans erreur.', test: p => p.counters.dailyPerfect >= 1 },
  { id: 'repechage', nom: 'Bon élève', emoji: '🩹', desc: 'Rattrape 10 questions ratées (3 réussites d\'affilée).', test: p => p.counters.redeemed >= 10 },
  { id: 'niveau-5', nom: 'Chef de rayon', emoji: '📦', desc: 'Atteins le niveau « Chef de rayon ».', test: p => levelOf(p.xp) >= 5 },
  { id: 'niveau-8', nom: 'Légende de la vente', emoji: '👑', desc: 'Atteins le niveau maximal.', test: p => levelOf(p.xp) >= 8 },
  ...masteryBadges,
  {
    id: 'grand-maitre', nom: 'Grand maître MCV', emoji: '🏅', desc: 'Maîtrise les 8 thèmes.',
    test: p => THEMES.every(t => isMastered(p, t.id)),
  },
]

export const BADGE_BY_ID = Object.fromEntries(BADGES.map(b => [b.id, b])) as Record<string, BadgeDef>
