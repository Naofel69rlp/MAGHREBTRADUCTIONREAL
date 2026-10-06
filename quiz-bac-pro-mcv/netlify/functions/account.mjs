// Comptes élèves : pseudo + mot de passe, progression sauvegardée dans Netlify Blobs.
// - mots de passe hachés (scrypt + sel), jamais stockés en clair
// - sessions par jeton signé HMAC (30 jours) ; secret = AUTH_SECRET ou secret généré et stocké automatiquement
import { getStore } from '@netlify/blobs'
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const TOKEN_TTL = 30 * 24 * 3600 * 1000
const MAX_PROFILE_BYTES = 300_000
const PSEUDO_RE = /^[\p{L}\p{N}_\- ]{2,16}$/u

// Stockage : Netlify Blobs en production ; mémoire uniquement si demandé explicitement (tests locaux)
const memory = new Map()
const memoryStore = {
  get: async (k) => memory.get(k) ?? null,
  setJSON: async (k, v) => { memory.set(k, structuredClone(v)) },
}
const db = () => (process.env.ACCOUNT_STORE === 'memory' ? memoryStore : getStore({ name: 'accounts', consistency: 'strong' }))

let cachedSecret = null
async function secret(store) {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET
  if (cachedSecret) return cachedSecret
  let s = await store.get('_secret', { type: 'json' })
  if (!s) {
    s = { value: randomBytes(32).toString('hex') }
    await store.setJSON('_secret', s)
  }
  return (cachedSecret = s.value)
}

const userKey = (pseudo) => 'u:' + pseudo.trim().replace(/\s+/g, ' ').toLowerCase()
const hash = (password, salt) => scryptSync(password, salt, 64)

function sign(payload, key) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${createHmac('sha256', key).update(body).digest('base64url')}`
}

function verify(token, key) {
  if (typeof token !== 'string') return null
  const [body, mac] = token.split('.')
  if (!body || !mac) return null
  const expected = createHmac('sha256', key).update(body).digest('base64url')
  const a = Buffer.from(mac), b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString())
    return p.exp > Date.now() ? p : null
  } catch {
    return null
  }
}

function validProfile(p) {
  return p && typeof p === 'object' && p.version === 1 && typeof p.xp === 'number' && typeof p.pseudo === 'string'
    && JSON.stringify(p).length < MAX_PROFILE_BYTES
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)
  let b
  try { b = await req.json() } catch { return json({ error: 'Requête invalide' }, 400) }

  const store = db()
  let key
  try { key = await secret(store) } catch (e) {
    console.error('Blobs indisponible', e)
    return json({ error: 'Stockage indisponible sur le serveur.' }, 500)
  }

  try {
    // --- actions avec jeton : charger / sauvegarder
    if (b.action === 'load' || b.action === 'save') {
      const t = verify(b.token, key)
      if (!t) return json({ error: 'Session expirée, reconnecte-toi.' }, 401)
      const rec = await store.get('u:' + t.u, { type: 'json' })
      if (!rec) return json({ error: 'Compte introuvable.' }, 404)
      if (b.action === 'load') return json({ profile: rec.profile ?? null })
      if (!validProfile(b.profile)) return json({ error: 'Profil invalide.' }, 400)
      rec.profile = b.profile
      rec.updatedAt = Date.now()
      await store.setJSON('u:' + t.u, rec)
      return json({ ok: true })
    }

    // --- inscription / connexion
    const pseudo = String(b.pseudo ?? '').trim()
    const password = String(b.password ?? '')
    if (!PSEUDO_RE.test(pseudo)) return json({ error: 'Pseudo : 2 à 16 caractères (lettres, chiffres, espace, - et _).' }, 400)
    if (password.length < 6 || password.length > 100) return json({ error: 'Mot de passe : au moins 6 caractères.' }, 400)
    const k = userKey(pseudo)
    const id = k.slice(2)
    const existing = await store.get(k, { type: 'json' })

    if (b.action === 'register') {
      if (existing) return json({ error: 'Ce pseudo est déjà pris.' }, 409)
      const salt = randomBytes(16).toString('hex')
      await store.setJSON(k, {
        pseudo, salt, hash: hash(password, salt).toString('hex'),
        profile: validProfile(b.profile) ? b.profile : null,
        createdAt: Date.now(), updatedAt: Date.now(), fails: 0, lockUntil: 0,
      })
      return json({ token: sign({ u: id, exp: Date.now() + TOKEN_TTL }, key), pseudo })
    }

    if (b.action === 'login') {
      const bad = () => json({ error: 'Pseudo ou mot de passe incorrect.' }, 401)
      if (!existing) return bad()
      if (existing.lockUntil > Date.now()) return json({ error: 'Trop d\'essais. Réessaie dans une minute.' }, 429)
      const ok = timingSafeEqual(hash(password, existing.salt), Buffer.from(existing.hash, 'hex'))
      if (!ok) {
        existing.fails = (existing.fails ?? 0) + 1
        if (existing.fails >= 5) { existing.lockUntil = Date.now() + 60_000; existing.fails = 0 }
        await store.setJSON(k, existing)
        return bad()
      }
      if (existing.fails || existing.lockUntil) { existing.fails = 0; existing.lockUntil = 0; await store.setJSON(k, existing) }
      return json({ token: sign({ u: id, exp: Date.now() + TOKEN_TTL }, key), pseudo: existing.pseudo, profile: existing.profile ?? null })
    }

    return json({ error: 'Action inconnue' }, 400)
  } catch (e) {
    console.error('account error', e)
    return json({ error: 'Erreur serveur.' }, 500)
  }
}
