# MaghrebTraduction — PRD

## Problem Statement
Application mobile (iOS + Android, Expo) de traduction spécialisée dans les dialectes du
Maghreb ET les grandes langues internationales. Anciennement « MaghrebTalk », renommée
**MaghrebTraduction**.

## Architecture
- **Frontend**: Expo Router (SDK 54), file-based routing, react-native-reanimated,
  react-native-keyboard-controller, expo-audio (TTS playback + recording), expo-blur,
  expo-linear-gradient, expo-image. Polices custom Playfair Display + Plus Jakarta Sans
  via expo-font.
- **Backend**: FastAPI + MongoDB (motor). Tous les endpoints sous `/api`.
- **IA**: emergentintegrations — Claude Sonnet 5 (primaire) + GPT 5.4 (fallback) pour la
  traduction ; OpenAI TTS `tts-1` (voix onyx) ; Whisper `whisper-1` (STT). Via EMERGENT_LLM_KEY.
- **Auth**: Google OAuth Emergent-managed (session_token 7 jours, expo-secure-store).

## User Personas
- Voyageur / expatrié francophone au Maghreb qui veut communiquer en darija/derja.
- Membre de la diaspora souhaitant apprendre/retrouver le dialecte familial.

## Core Requirements (static)
1. Traduction écrite IA fr ⇄ ma/dz/tn avec transcription phonétique latine.
2. Compréhension de l'écriture latine avec chiffres (3, 7, 9…).
3. Lecture audio de la traduction (TTS).
4. Reconnaissance vocale / dictée (STT).
5. Historique + Favoris.
6. Expressions courantes (phrasebook par dialecte).
7. Inversion des langues.
8. Freemium : 3 traductions/jour gratuites, Premium illimité (5€/mois, 45€/an).

## Implemented (2026-08-15)
- Auth Google Emergent (login screen, AuthContext, session persistée).
- Écran Accueil : logo, sélecteur de langues glass avec swap, zone de saisie, micro
  (dictée Whisper), bouton Traduire, carte résultat (texte + phonétique + Écouter/Copier/Favori).
- Compteur quotidien gratuit visible (chip → écran Premium).
- Historique (liste, écouter, ajouter en favori, effacer tout, pull-to-refresh).
- Favoris (liste, écouter, supprimer).
- Expressions : 6 catégories, chips dialecte (MA/DZ/TN) + chips catégorie, écouter + favori.
- Écran Premium (paywall luxe dark, plans 5€/45€, CTA — paiement à venir).
- Backend complet testé (27/27 tests passés) : auth, usage/quota, translate, tts, transcribe,
  history, favorites, expressions.

## Backlog (prioritised)
- **P1** Abonnements réels via RevenueCat (l'utilisateur a demandé à sauter pour l'instant).
- **P1** Détection automatique de la langue source.
- **P2** Mode conversation (aller-retour vocal).
- **P2** Sauvegarde hors-ligne des expressions.

## Next Tasks
- Activer RevenueCat quand l'utilisateur connecte son compte.

## Update 2026-08-15 — Rebrand + multilingue + i18n
- **Renommage** MaghrebTalk → **MaghrebTraduction** partout dans l'UI (login, splash,
  header d'accueil, premium, app.json name, message racine API).
- **Nouvelles langues de traduction** ajoutées : Anglais 🇬🇧, Espagnol 🇪🇸, Italien 🇮🇹,
  Néerlandais 🇳🇱 (en plus de fr/ma/dz/tn). Toutes combinaisons source→cible possibles.
  Backend LANGUAGES + DIALECTS + prompt généralisés ; LANG_ISO pour STT étendu.
- **Sélecteur de langues repensé** : composant `Flag` (drapeaux dessinés en Views, sans
  emoji), nom localisé, barre d'accent couleur pour les 4 langues principales (FR bleu,
  MA rouge, DZ vert, TN rouge), picker scrollable avec 8 langues.
- **i18n interface** : `I18nProvider` + dictionnaire 7 locales (FR, EN, ES, IT, NL, DE, PT),
  sélecteur dans le nouvel écran **Réglages** (`app/settings.tsx`), choix persisté via
  `storage.setItem` (localStorage web / natif) → conservé au redémarrage.
- **Réglages** accessibles via une icône engrenage dans le header d'accueil ; section Compte
  (email, statut Premium, déconnexion).
- Vérifié e2e (viewport mobile) : traduction FR→EN, EN→TN, NL→FR ; picker 8 langues ;
  bascule d'interface FR↔EN persistante ; drapeaux/couleurs des 4 principales.

## Notes
- Fonctionnalités micro/audio testables pleinement sur build natif ; en web preview la
  dictée est désactivée avec message.

## Update 2026-08-17 — Traduire avec l'appareil photo (OCR + IA vision)
- **Nouvelle fonctionnalité** : bouton 📷 sur l'écran principal (footer de saisie) →
  ouvre `app/camera.tsx` (fullScreenModal).
- **Écran caméra** : `CameraView` (expo-camera), cadre de détection doré, bouton photo
  central, bouton galerie (expo-image-picker), sélecteur de langue cible (modal), bouton
  retour. Phases : caméra → aperçu (bouton « Traduire ») → résultat.
- **OCR + traduction** via vision IA Claude Sonnet 5 (fallback GPT 5.4) en un seul appel :
  extraction texte + détection langue source + traduction. Endpoint `POST /api/ocr-translate`
  (image_base64 + target_lang), image redimensionnée/compressée client (expo-image-manipulator),
  jamais stockée côté serveur. Compte comme 1 traduction (quota gratuit 3/j ; premium illimité) ;
  pré-vérification quota → 429 → paywall. Si aucun texte : message clair, pas de décompte.
- **Résultat** : carte « Texte détecté » (drapeau source + texte, RTL si dialecte) +
  `ResultCard` (écouter/copier/favori) + bouton « Ajouter à l'historique » (manuel, non auto).
  Changement de langue cible → relance instantanée.
- **Endpoint** `POST /api/history` ajouté pour l'ajout manuel à l'historique.
- **Permissions** : NSCameraUsageDescription/NSPhotoLibraryUsageDescription (iOS) + CAMERA (Android),
  flux de permission contextuel avec repli « Ouvrir réglages ».
- **i18n** : clés caméra ajoutées aux 7 locales.
- **Package Android** renommé `com.maghrebtraduction.app`.
- Vérifié backend e2e : OCR FR→EN, OCR FR→MA (arabe + phonétique), POST /history. UI caméra
  testable uniquement sur appareil réel / Expo Go (pas en web preview).
