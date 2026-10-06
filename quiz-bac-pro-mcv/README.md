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

## IA (explications) et déploiement Netlify

Le bouton « 🤖 Explique-moi avec l'IA » appelle la fonction `netlify/functions/ai.mjs`, qui interroge l'API Gemini. **La clé n'est jamais dans le code du site** : elle est lue côté serveur via la variable `GEMINI_API_KEY`.

- **En local** : copier `.env.example` en `.env`, y mettre la clé, puis `npx netlify dev` (le `.env` est ignoré par git).
- **Déploiement** : pousser le dépôt sur GitHub, créer un site sur Netlify en choisissant ce dépôt, avec *Base directory* `quiz-bac-pro-mcv` (le `netlify.toml` fournit build `npm run build`, dossier `dist` et la fonction). Puis *Site configuration → Environment variables* : ajouter `GEMINI_API_KEY`. Sans clé, le quiz fonctionne, seul le bouton IA affiche une erreur.

## Comptes élèves (sauvegarde en ligne)

- Création de compte / connexion par **pseudo + mot de passe** (onglets sur l'écran d'accueil), ou mode **Invité** (progression sur l'appareil uniquement). Un invité peut créer un compte plus tard depuis « Mes stats » : sa progression est alors envoyée au compte.
- La progression (XP, niveau, badges, série, stats) est sauvegardée automatiquement dans **Netlify Blobs** via la fonction `netlify/functions/account.mjs` : aucun service externe ni configuration à faire.
- Sécurité : mots de passe hachés (scrypt + sel), sessions par jeton signé (30 jours), verrouillage d'1 minute après 5 mauvais essais. Pas d'e-mail : un mot de passe oublié ne peut pas être récupéré (il faut créer un nouveau compte). Optionnel : variable `AUTH_SECRET` pour fixer le secret de signature.
- Le service de comptes ne fonctionne qu'une fois déployé sur Netlify (ou avec `npx netlify dev`) ; avec `npm run dev` seul, le mode Invité reste disponible.

## Audio
Sons et **musique de fond** (boucle originale synthétisée, jouée pendant les parties) : deux boutons en haut à droite (🎵 musique, 🔊 son).
