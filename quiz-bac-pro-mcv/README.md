# MCV Quiz – Bac Pro Métiers du Commerce et de la Vente (option B, Terminale)

Quiz gamifié (XP, niveaux, combos, série quotidienne, badges, sons synthétisés) pour réviser le Bac Pro MCV option B.
100 % front-end : React + Vite + TypeScript + Tailwind CSS, Framer Motion, canvas-confetti. Progression sauvegardée dans le `localStorage`.

## Lancer le projet

```bash
cd quiz-bac-pro-mcv
npm install
npm run dev          # http://localhost:5173
npm run build        # build de production dans dist/
npm run preview      # tester le build
npm run check:questions   # valide la banque de questions
```

## Modes de jeu
Partie rapide (10 q.) · Par thème · Contre-la-montre (60 s) · Survie (3 vies) · Défi du jour (5 questions identiques pour tous, tirées avec un seed basé sur la date) · Révision des erreurs (une question ratée revient plus souvent, dans tous les modes, jusqu'à 3 réussites d'affilée).

## Ajouter des questions

Deux possibilités.

**1. Directement dans `src/data/questions.json`** :

```json
{
  "id": "b1-036",
  "theme": "bloc1",
  "difficulte": 2,
  "question": "Quelle est la première étape de la vente ?",
  "reponses": ["La prise de contact", "La conclusion", "L'argumentation", "Le SAV"],
  "bonneReponse": 0,
  "explication": "La prise de contact ouvre l'entretien de vente."
}
```

- `theme` : `bloc1`, `bloc2`, `bloc3`, `prospection`, `valorisation`, `calculs`, `droit`, `vocabulaire`
- `difficulte` : 1, 2 ou 3 ; `reponses` : exactement 4 ; `bonneReponse` : index de 0 à 3 ; `id` unique.
- L'ordre des réponses est mélangé automatiquement en jeu.

**2. Via les sources compactes `questions-src/<theme>.mjs`** (la bonne réponse est toujours en premier, le script la place au hasard) :

```js
[difficulté, "Question", "BONNE réponse", "mauvaise 1", "mauvaise 2", "mauvaise 3", "Explication"],
```

Puis `node scripts/build-questions.mjs` régénère le JSON (⚠️ cela écrase `questions.json` : choisissez une seule des deux méthodes). Terminez toujours par `npm run check:questions`.

## Structure

```
src/
  data/    questions.json, themes.ts, levels.ts, badges.ts
  lib/     game.ts (tirage, mélange, seed) · xp.ts · profile.ts · sounds.ts (Web Audio) · haptics.ts
  store/   GameContext.tsx (profil, progression, réglages)
  components/  Home, Game, Result, Stats, ThemeSelect, Onboarding, ComboBadge, ...
```

## Notes
- Aucun son externe : tout est synthétisé (Web Audio API), rien ne joue avant la première interaction ; le bouton 🔊 est toujours visible et sa préférence est mémorisée.
- Les questions sont à faire relire par l'enseignant·e avant diffusion (les définitions peuvent varier légèrement selon les cours, par ex. vente additionnelle/complémentaire, « règle des 4C » non incluse faute de définition unique).
