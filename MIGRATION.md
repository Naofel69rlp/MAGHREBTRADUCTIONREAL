# Migration hors d'Emergent — MaghrebTraduction

## Ce qui a été changé dans le code

**Backend (`backend/server.py`)**
- `emergentintegrations` retiré → appels directs aux SDK **OpenAI** et **Anthropic**.
- Authentification Google : l'ancien endpoint `/auth/session` (qui passait par
  `demobackend.emergentagent.com`) est remplacé par `/auth/google`, qui vérifie
  un `id_token` Google directement avec la librairie `google-auth` (déjà présente
  dans `requirements.txt`).
- TTS (`/api/tts`) et STT (`/api/transcribe`) utilisent maintenant directement
  `openai.audio.speech` et `openai.audio.transcriptions`.
- L'authentification Apple (`/auth/apple`) ne changeait déjà rien — elle vérifiait
  déjà le token directement auprès d'Apple.

**Frontend (`frontend/`)**
- `AuthContext.tsx` : le bouton Google n'ouvre plus `auth.emergentagent.com`,
  il utilise `expo-auth-session/providers/google` (Google Sign-In natif).
- `package.json` : ajout de `expo-auth-session` et `expo-crypto`.
- `.env` : variables de tunnel Emergent supprimées, remplacées par
  `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` et une URL de backend à définir.

## Ce qu'il te reste à faire

### 1. Créer les comptes / clés nécessaires
- **OpenAI** : clé API sur platform.openai.com → `OPENAI_API_KEY`
- **Anthropic** : clé API sur console.anthropic.com → `ANTHROPIC_API_KEY`
- **MongoDB Atlas** : cluster gratuit (M0) → récupère l'URI de connexion → `MONGO_URL`
- **Google Cloud Console** : crée un projet, active "Google Sign-In", puis crée
  3 identifiants OAuth 2.0 (type iOS, Android, Web) → renseigne les 3 dans
  `frontend/.env` et mets leurs "Client ID" dans `GOOGLE_CLIENT_IDS` côté backend
  (séparés par une virgule).

### 2. Déployer le backend sur Railway (recommandé)
Railway est le plus simple pour une API FastAPI + Docker : déploiement en
quelques clics depuis GitHub, pas de mise en veille sur le plan payant (~5$/mois),
et gère les variables d'environnement facilement.

1. Pousse ce dossier sur un repo GitHub.
2. Sur railway.app → "New Project" → "Deploy from GitHub repo" → sélectionne le repo,
   en indiquant `backend` comme dossier racine (Root Directory).
3. Railway détecte le `Dockerfile` automatiquement.
4. Dans l'onglet "Variables", ajoute : `MONGO_URL`, `DB_NAME`, `OPENAI_API_KEY`,
   `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_IDS`, `APPLE_AUDIENCES`, `PREMIUM_EMAILS`.
5. Récupère l'URL publique générée (Settings → Networking → Generate Domain).

*(Render ou Fly.io fonctionnent aussi avec le même Dockerfile si tu préfères.)*

### 3. Mettre à jour le frontend
- Dans `frontend/.env`, remplace `EXPO_PUBLIC_BACKEND_URL` par l'URL Railway obtenue.
- Renseigne les 3 `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`.
- Change `ios.bundleIdentifier` dans `app.json` (actuellement
  `com.emergent.darijachat.mhdwef`, qui appartient au namespace Emergent) pour
  un identifiant propre à ton compte Apple Developer, ex. `com.tonnom.maghrebtraduction`.
  Mets à jour `APPLE_AUDIENCES` côté backend en conséquence.
- `cd frontend && npx expo install expo-auth-session expo-crypto` pour installer
  les bonnes versions compatibles avec ton SDK Expo, puis `yarn install`.

### 4. Build & publication mobile (EAS)
```
npm install -g eas-cli
cd frontend
eas login
eas build:configure
eas build --platform ios
eas build --platform android
eas submit --platform ios
eas submit --platform android
```
Nécessite un compte Apple Developer (99$/an) et un compte Google Play Console (25$ unique).

## Récapitulatif des dépendances Emergent retirées
| Avant | Après |
|---|---|
| `emergentintegrations` (chat) | SDK `anthropic` + `openai` en direct |
| `EMERGENT_LLM_KEY` | `OPENAI_API_KEY` + `ANTHROPIC_API_KEY` |
| `demobackend.emergentagent.com` (auth Google) | vérification `id_token` via `google-auth` |
| `auth.emergentagent.com` (frontend) | `expo-auth-session` (Google Sign-In natif) |
| Hébergement Emergent | Railway (backend) + MongoDB Atlas (base de données) |
