import os
import json
import uuid
import hashlib
import logging
import tempfile
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
import jwt
import bcrypt
from jwt import PyJWKClient
from fastapi import FastAPI, APIRouter, Header, HTTPException, Depends, UploadFile, File, Form, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

from openai import AsyncOpenAI
import anthropic
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from expressions_data import EXPRESSIONS

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

OPENAI_API_KEY = os.environ['OPENAI_API_KEY']
ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY', '')
GOOGLE_CLIENT_IDS = [c.strip() for c in os.environ.get("GOOGLE_CLIENT_IDS", "").split(",") if c.strip()]

openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
anthropic_client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None
_google_request = google_requests.Request()

APPLE_ISSUER = "https://appleid.apple.com"
APPLE_AUDIENCES = [a.strip() for a in os.environ.get("APPLE_AUDIENCES", "").split(",") if a.strip()]
_apple_jwk_client = PyJWKClient("https://appleid.apple.com/auth/keys")

FREE_DAILY_LIMIT = 3

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

LANGUAGES = {
    "fr": "français",
    "ma": "darija marocaine (dialecte arabe marocain)",
    "dz": "derja algérienne (dialecte arabe algérien)",
    "tn": "derja tunisienne (dialecte arabe tunisien)",
    "en": "anglais",
    "es": "espagnol",
    "it": "italien",
    "nl": "néerlandais",
}

DIALECTS = {"ma", "dz", "tn"}


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class GoogleAuthRequest(BaseModel):
    id_token: str


class RegisterRequest(BaseModel):
    username: str
    first_name: str
    last_name: str
    email: str
    password: str
    phone: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class AppleAuthRequest(BaseModel):
    identity_token: str
    name: Optional[str] = None
    email: Optional[str] = None


class TranslateRequest(BaseModel):
    text: str
    source_lang: str
    target_lang: str


class FavoriteRequest(BaseModel):
    source_text: str
    translated_text: str
    phonetic: str = ""
    source_lang: str
    target_lang: str


class TTSRequest(BaseModel):
    text: str
    lang: str = "ma"


class OcrTranslateRequest(BaseModel):
    image_base64: str
    target_lang: str
    source_lang: str = "auto"


class HistorySaveRequest(BaseModel):
    source_text: str
    translated_text: str
    phonetic: str = ""
    source_lang: str
    target_lang: str


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def _now() -> datetime:
    return datetime.now(timezone.utc)


PREMIUM_EMAILS = {
    e.strip().lower()
    for e in os.environ.get("PREMIUM_EMAILS", "nao.ruijaa@gmail.com").split(",")
    if e.strip()
}


def _is_premium(user: dict) -> bool:
    return bool(user.get("is_premium")) or (user.get("email", "").lower() in PREMIUM_EMAILS)


def _serialize_user(doc: dict) -> dict:
    return {
        "id": doc["user_id"],
        "email": doc["email"],
        "name": doc.get("name", ""),
        "username": doc.get("username", ""),
        "phone": doc.get("phone", ""),
        "picture": doc.get("picture", ""),
        "is_premium": _is_premium(doc),
    }


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < _now():
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api_router.post("/auth/google")
async def google_auth(payload: GoogleAuthRequest):
    if not GOOGLE_CLIENT_IDS:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_IDS non configuré")
    try:
        idinfo = google_id_token.verify_oauth2_token(
            payload.id_token, _google_request
        )
        if idinfo.get("aud") not in GOOGLE_CLIENT_IDS:
            raise ValueError("Audience invalide")
        if idinfo.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
            raise ValueError("Émetteur invalide")
    except Exception as e:  # noqa: BLE001
        logger.warning("Google token verification failed: %s", e)
        raise HTTPException(status_code=401, detail="Token Google invalide")

    email = idinfo.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="Token Google sans email")
    name = idinfo.get("name", "")
    picture = idinfo.get("picture", "")

    existing = await db.users.find_one({"email": email})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "is_premium": False,
            "created_at": _now(),
        })

    session_token = f"google_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "created_at": _now(),
        "expires_at": _now() + timedelta(days=7),
    })

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"session_token": session_token, "user": _serialize_user(user)}


@api_router.post("/auth/register")
async def register(payload: RegisterRequest):
    email = payload.email.strip().lower()
    username = payload.username.strip()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Adresse email invalide")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 6 caractères")
    if not username:
        raise HTTPException(status_code=400, detail="Nom d'utilisateur requis")

    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="Un compte existe déjà avec cet email")
    existing_username = await db.users.find_one({"username": username})
    if existing_username:
        raise HTTPException(status_code=409, detail="Ce nom d'utilisateur est déjà pris")

    password_hash = bcrypt.hashpw(payload.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    full_name = f"{payload.first_name.strip()} {payload.last_name.strip()}".strip()
    await db.users.insert_one({
        "user_id": user_id,
        "email": email,
        "username": username,
        "first_name": payload.first_name.strip(),
        "last_name": payload.last_name.strip(),
        "name": full_name,
        "phone": (payload.phone or "").strip(),
        "password_hash": password_hash,
        "picture": "",
        "is_premium": False,
        "created_at": _now(),
    })

    session_token = f"local_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "created_at": _now(),
        "expires_at": _now() + timedelta(days=7),
    })

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"session_token": session_token, "user": _serialize_user(user)}


@api_router.post("/auth/login")
async def login(payload: LoginRequest):
    email = payload.email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

    if not bcrypt.checkpw(payload.password.encode("utf-8"), user["password_hash"].encode("utf-8")):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

    session_token = f"local_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user["user_id"],
        "created_at": _now(),
        "expires_at": _now() + timedelta(days=7),
    })

    return {"session_token": session_token, "user": _serialize_user(user)}


@api_router.post("/auth/apple")
async def apple_auth(payload: AppleAuthRequest):
    if not APPLE_AUDIENCES:
        raise HTTPException(status_code=500, detail="APPLE_AUDIENCES non configuré")
    try:
        signing_key = _apple_jwk_client.get_signing_key_from_jwt(payload.identity_token)
        decoded = jwt.decode(
            payload.identity_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=APPLE_AUDIENCES,
            issuer=APPLE_ISSUER,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("Apple token verification failed: %s", e)
        raise HTTPException(status_code=401, detail="Token Apple invalide")

    apple_sub = decoded.get("sub")
    if not apple_sub:
        raise HTTPException(status_code=401, detail="Token Apple sans identifiant")

    email = payload.email or decoded.get("email")
    name = (payload.name or "").strip()

    user = await db.users.find_one({"apple_sub": apple_sub})
    if not user and email:
        user = await db.users.find_one({"email": email})

    if user:
        user_id = user["user_id"]
        updates = {"apple_sub": apple_sub}
        if name and not user.get("name"):
            updates["name"] = name
        await db.users.update_one({"user_id": user_id}, {"$set": updates})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "apple_sub": apple_sub,
            "email": email or f"apple_{apple_sub}@maghrebtalk.local",
            "name": name,
            "picture": "",
            "is_premium": False,
            "created_at": _now(),
        })

    session_token = f"apple_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "created_at": _now(),
        "expires_at": _now() + timedelta(days=7),
    })

    u = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"session_token": session_token, "user": _serialize_user(u)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return _serialize_user(user)


@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"success": True}


# ---------------------------------------------------------------------------
# Usage / quota
# ---------------------------------------------------------------------------
def _today_key() -> str:
    return _now().strftime("%Y-%m-%d")


async def _usage_state(user: dict) -> dict:
    is_premium = _is_premium(user)
    doc = await db.usage.find_one(
        {"user_id": user["user_id"], "date": _today_key()}, {"_id": 0}
    )
    used = doc["count"] if doc else 0
    tomorrow = (_now() + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return {
        "used": used,
        "limit": FREE_DAILY_LIMIT,
        "remaining": -1 if is_premium else max(0, FREE_DAILY_LIMIT - used),
        "is_premium": is_premium,
        "resets_at": tomorrow.isoformat(),
    }


async def _increment_usage(user_id: str):
    await db.usage.update_one(
        {"user_id": user_id, "date": _today_key()},
        {"$inc": {"count": 1}},
        upsert=True,
    )


@api_router.get("/usage")
async def get_usage(user: dict = Depends(get_current_user)):
    return await _usage_state(user)


# ---------------------------------------------------------------------------
# Translation
# ---------------------------------------------------------------------------
def _build_prompt(text: str, source_lang: str, target_lang: str) -> str:
    src = LANGUAGES[source_lang]
    tgt = LANGUAGES[target_lang]
    target_is_dialect = target_lang in DIALECTS
    guidance = (
        "Tu es un traducteur expert, spécialisé notamment dans les dialectes du Maghreb "
        "(darija marocaine, derja algérienne, derja tunisienne) ainsi que dans les grandes "
        "langues internationales.\n"
        "Tu comprends parfaitement l'écriture latine avec chiffres utilisée au Maghreb "
        "(ex: 3='ع', 7='ح', 9='ق', 2='ء', 5/kh='خ', 8='غ').\n"
        f"Traduis le texte suivant du {src} vers le {tgt}.\n"
        "Donne une traduction naturelle et authentique, telle qu'un natif la dirait.\n\n"
    )
    if target_is_dialect:
        fmt = (
            'Réponds STRICTEMENT en JSON valide avec ce format exact:\n'
            '{"translation": "<traduction en écriture arabe>", '
            '"phonetic": "<transcription phonétique en lettres latines>"}\n'
        )
    else:
        fmt = (
            'Réponds STRICTEMENT en JSON valide avec ce format exact:\n'
            '{"translation": "<traduction en français>", "phonetic": ""}\n'
        )
    return guidance + fmt + f'\nTexte à traduire:\n"""{text}"""'


_TRANSLATE_SYSTEM = "Tu es un traducteur professionnel des dialectes maghrébins. Tu réponds uniquement en JSON valide."


async def _run_llm(prompt: str) -> str:
    last_err = None
    if anthropic_client:
        try:
            resp = await anthropic_client.messages.create(
                model="claude-sonnet-5",
                max_tokens=1024,
                system=_TRANSLATE_SYSTEM,
                messages=[{"role": "user", "content": prompt}],
            )
            return resp.content[0].text
        except Exception as e:  # noqa: BLE001
            last_err = e
            logger.warning("LLM provider anthropic failed: %s", e)
    try:
        resp = await openai_client.chat.completions.create(
            model="gpt-5.4",
            messages=[
                {"role": "system", "content": _TRANSLATE_SYSTEM},
                {"role": "user", "content": prompt},
            ],
        )
        return resp.choices[0].message.content
    except Exception as e:  # noqa: BLE001
        last_err = e
        logger.warning("LLM provider openai failed: %s", e)
    raise HTTPException(status_code=502, detail=f"Translation service unavailable: {last_err}")


def _parse_llm_json(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1:
        raw = raw[start:end + 1]
    try:
        data = json.loads(raw)
        return {
            "translation": str(data.get("translation", "")).strip(),
            "phonetic": str(data.get("phonetic", "")).strip(),
        }
    except Exception:  # noqa: BLE001
        return {"translation": raw, "phonetic": ""}


@api_router.post("/translate")
async def translate(payload: TranslateRequest, user: dict = Depends(get_current_user)):
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Le texte est vide")
    if payload.source_lang not in LANGUAGES or payload.target_lang not in LANGUAGES:
        raise HTTPException(status_code=400, detail="Langue invalide")

    prompt = _build_prompt(text, payload.source_lang, payload.target_lang)
    raw = await _run_llm(prompt)
    parsed = _parse_llm_json(raw)

    if not _is_premium(user):
        await _increment_usage(user["user_id"])

    entry = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "source_text": text,
        "translated_text": parsed["translation"],
        "phonetic": parsed["phonetic"],
        "source_lang": payload.source_lang,
        "target_lang": payload.target_lang,
        "is_favorite": False,
        "created_at": _now(),
    }
    await db.history.insert_one(dict(entry))

    new_usage = await _usage_state(user)
    return {
        "id": entry["id"],
        "source_text": entry["source_text"],
        "translated_text": entry["translated_text"],
        "phonetic": entry["phonetic"],
        "source_lang": entry["source_lang"],
        "target_lang": entry["target_lang"],
        "is_favorite": False,
        "created_at": entry["created_at"].isoformat(),
        "usage": new_usage,
    }


# ---------------------------------------------------------------------------
# Camera OCR + translation
# ---------------------------------------------------------------------------
def _build_ocr_prompt(target_lang: str) -> str:
    tgt = LANGUAGES[target_lang]
    target_is_dialect = target_lang in DIALECTS
    codes = (
        "fr, ma (darija marocaine), dz (derja algérienne), tn (derja tunisienne), "
        "en, es, it, nl"
    )
    guidance = (
        "Tu reçois une PHOTO contenant du texte (panneau, menu, affiche, enseigne, "
        "document, écran...).\n"
        "1) Fais de l'OCR : extrais fidèlement TOUT le texte lisible de l'image. Tu maîtrises "
        "parfaitement l'arabe et les dialectes du Maghreb, ainsi que l'écriture latine avec "
        "chiffres (3='ع', 7='ح', 9='ق', 2='ء', 5/kh='خ', 8='غ').\n"
        "2) Identifie la langue du texte et renvoie son code parmi : " + codes + ". "
        "Choisis le plus proche ; si le texte est en arabe standard ou maghrébin, choisis "
        "ma, dz ou tn selon le pays le plus probable.\n"
        f"3) Traduis ce texte vers le {tgt} de manière naturelle et authentique.\n\n"
    )
    if target_is_dialect:
        fmt = (
            'Réponds STRICTEMENT en JSON valide avec ce format exact :\n'
            '{"detected_text":"<texte original détecté>","detected_lang":"<code>",'
            '"translation":"<traduction en écriture arabe>",'
            '"phonetic":"<transcription phonétique en lettres latines>"}\n'
        )
    else:
        fmt = (
            'Réponds STRICTEMENT en JSON valide avec ce format exact :\n'
            '{"detected_text":"<texte original détecté>","detected_lang":"<code>",'
            '"translation":"<traduction>","phonetic":""}\n'
        )
    tail = (
        '\nSi aucun texte lisible n\'est présent dans l\'image, renvoie exactement :\n'
        '{"detected_text":"","detected_lang":"","translation":"","phonetic":""}'
    )
    return guidance + fmt + tail


_OCR_SYSTEM = "Tu es un expert en OCR et en traduction des dialectes maghrébins. Tu réponds uniquement en JSON valide."


async def _run_llm_vision(prompt: str, image_base64: str) -> str:
    last_err = None
    if anthropic_client:
        try:
            resp = await anthropic_client.messages.create(
                model="claude-sonnet-5",
                max_tokens=1024,
                system=_OCR_SYSTEM,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {"type": "base64", "media_type": "image/jpeg", "data": image_base64},
                        },
                        {"type": "text", "text": prompt},
                    ],
                }],
            )
            return resp.content[0].text
        except Exception as e:  # noqa: BLE001
            last_err = e
            logger.warning("Vision LLM provider anthropic failed: %s", e)
    try:
        resp = await openai_client.chat.completions.create(
            model="gpt-5.4",
            messages=[
                {"role": "system", "content": _OCR_SYSTEM},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}},
                    ],
                },
            ],
        )
        return resp.choices[0].message.content
    except Exception as e:  # noqa: BLE001
        last_err = e
        logger.warning("Vision LLM provider openai failed: %s", e)
    raise HTTPException(status_code=502, detail=f"OCR service unavailable: {last_err}")


def _parse_ocr_json(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1:
        raw = raw[start:end + 1]
    try:
        data = json.loads(raw)
    except Exception:  # noqa: BLE001
        return {"detected_text": "", "detected_lang": "", "translation": "", "phonetic": ""}
    return {
        "detected_text": str(data.get("detected_text", "")).strip(),
        "detected_lang": str(data.get("detected_lang", "")).strip().lower(),
        "translation": str(data.get("translation", "")).strip(),
        "phonetic": str(data.get("phonetic", "")).strip(),
    }


@api_router.post("/ocr-translate")
async def ocr_translate(payload: OcrTranslateRequest, user: dict = Depends(get_current_user)):
    if payload.target_lang not in LANGUAGES:
        raise HTTPException(status_code=400, detail="Langue invalide")
    img = payload.image_base64.strip()
    if not img:
        raise HTTPException(status_code=400, detail="Image manquante")
    if img.startswith("data:") and "," in img:
        img = img.split(",", 1)[1]

    # NOTE: The free daily quota is gated CLIENT-SIDE (RevenueCat entitlement OR
    # backend allowlist), exactly like /translate. The backend does NOT hard-block
    # here, otherwise a RevenueCat-Premium user (unknown to the backend) would be
    # wrongly refused. We only meter usage below.
    state = await _usage_state(user)

    prompt = _build_ocr_prompt(payload.target_lang)
    raw = await _run_llm_vision(prompt, img)
    parsed = _parse_ocr_json(raw)

    # No readable text — do not count usage, let the client show a clear message.
    if not parsed["detected_text"] and not parsed["translation"]:
        return {
            "source_text": "",
            "translated_text": "",
            "phonetic": "",
            "source_lang": "",
            "target_lang": payload.target_lang,
            "no_text": True,
            "usage": state,
        }

    src = parsed["detected_lang"] if parsed["detected_lang"] in LANGUAGES else "fr"

    if not _is_premium(user):
        await _increment_usage(user["user_id"])
    usage = await _usage_state(user)

    return {
        "source_text": parsed["detected_text"],
        "translated_text": parsed["translation"],
        "phonetic": parsed["phonetic"],
        "source_lang": src,
        "target_lang": payload.target_lang,
        "no_text": False,
        "usage": usage,
    }


# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------
def _serialize_history(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "source_text": doc["source_text"],
        "translated_text": doc["translated_text"],
        "phonetic": doc.get("phonetic", ""),
        "source_lang": doc["source_lang"],
        "target_lang": doc["target_lang"],
        "is_favorite": doc.get("is_favorite", False),
        "created_at": doc["created_at"].isoformat() if isinstance(doc["created_at"], datetime) else doc["created_at"],
    }


@api_router.get("/history")
async def get_history(user: dict = Depends(get_current_user)):
    docs = await db.history.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return [_serialize_history(d) for d in docs]


@api_router.post("/history")
async def add_history(payload: HistorySaveRequest, user: dict = Depends(get_current_user)):
    if payload.source_lang not in LANGUAGES or payload.target_lang not in LANGUAGES:
        raise HTTPException(status_code=400, detail="Langue invalide")
    entry = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "source_text": payload.source_text,
        "translated_text": payload.translated_text,
        "phonetic": payload.phonetic,
        "source_lang": payload.source_lang,
        "target_lang": payload.target_lang,
        "is_favorite": False,
        "created_at": _now(),
    }
    await db.history.insert_one(dict(entry))
    return _serialize_history(entry)


@api_router.delete("/history/{item_id}")
async def delete_history(item_id: str, user: dict = Depends(get_current_user)):
    await db.history.delete_one({"id": item_id, "user_id": user["user_id"]})
    return {"success": True}


@api_router.delete("/history")
async def clear_history(user: dict = Depends(get_current_user)):
    await db.history.delete_many({"user_id": user["user_id"]})
    return {"success": True}


# ---------------------------------------------------------------------------
# Favorites
# ---------------------------------------------------------------------------
def _serialize_fav(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "source_text": doc["source_text"],
        "translated_text": doc["translated_text"],
        "phonetic": doc.get("phonetic", ""),
        "source_lang": doc["source_lang"],
        "target_lang": doc["target_lang"],
        "created_at": doc["created_at"].isoformat() if isinstance(doc["created_at"], datetime) else doc["created_at"],
    }


@api_router.get("/favorites")
async def get_favorites(user: dict = Depends(get_current_user)):
    docs = await db.favorites.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return [_serialize_fav(d) for d in docs]


@api_router.post("/favorites")
async def add_favorite(payload: FavoriteRequest, user: dict = Depends(get_current_user)):
    existing = await db.favorites.find_one({
        "user_id": user["user_id"],
        "source_text": payload.source_text,
        "translated_text": payload.translated_text,
    }, {"_id": 0})
    if existing:
        return _serialize_fav(existing)
    entry = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "source_text": payload.source_text,
        "translated_text": payload.translated_text,
        "phonetic": payload.phonetic,
        "source_lang": payload.source_lang,
        "target_lang": payload.target_lang,
        "created_at": _now(),
    }
    await db.favorites.insert_one(dict(entry))
    await db.history.update_many(
        {"user_id": user["user_id"], "source_text": payload.source_text,
         "translated_text": payload.translated_text},
        {"$set": {"is_favorite": True}},
    )
    return _serialize_fav(entry)


@api_router.delete("/favorites/{item_id}")
async def delete_favorite(item_id: str, user: dict = Depends(get_current_user)):
    fav = await db.favorites.find_one({"id": item_id, "user_id": user["user_id"]}, {"_id": 0})
    if fav:
        await db.history.update_many(
            {"user_id": user["user_id"], "source_text": fav["source_text"],
             "translated_text": fav["translated_text"]},
            {"$set": {"is_favorite": False}},
        )
    await db.favorites.delete_one({"id": item_id, "user_id": user["user_id"]})
    return {"success": True}


# ---------------------------------------------------------------------------
# Expressions (phrasebook)
# ---------------------------------------------------------------------------
@api_router.get("/expressions")
async def get_expressions():
    return EXPRESSIONS


# ---------------------------------------------------------------------------
# Text to speech
# ---------------------------------------------------------------------------
def _tts_key(text: str) -> str:
    return hashlib.sha256(f"{text}|onyx|1.0|tts-1|mp3".encode()).hexdigest()


@api_router.post("/tts")
async def create_tts(payload: TTSRequest, user: dict = Depends(get_current_user)):
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Texte vide")
    text = text[:4096]
    key = _tts_key(text)
    cached = await db.tts_cache.find_one({"key": key}, {"_id": 0, "audio": 0})
    if not cached:
        try:
            resp = await openai_client.audio.speech.create(model="tts-1", voice="onyx", input=text)
            audio = resp.read()
        except Exception as e:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=f"TTS indisponible: {e}")
        await db.tts_cache.update_one(
            {"key": key},
            {"$set": {"key": key, "audio": audio, "created_at": _now()}},
            upsert=True,
        )
    return {"url": f"/api/tts/{key}.mp3"}


@api_router.get("/tts/{key}.mp3")
async def get_tts(key: str):
    doc = await db.tts_cache.find_one({"key": key})
    if not doc:
        raise HTTPException(status_code=404, detail="Audio introuvable")
    return Response(
        content=doc["audio"],
        media_type="audio/mpeg",
        headers={"Cache-Control": "public, max-age=31536000"},
    )


# ---------------------------------------------------------------------------
# Speech to text
# ---------------------------------------------------------------------------
LANG_ISO = {"fr": "fr", "ma": "ar", "dz": "ar", "tn": "ar", "en": "en", "es": "es", "it": "it", "nl": "nl"}


@api_router.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    lang: str = Form("fr"),
    user: dict = Depends(get_current_user),
):
    suffix = Path(file.filename or "audio.m4a").suffix or ".m4a"
    if suffix.lstrip(".").lower() not in ["mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm"]:
        suffix = ".m4a"
    data = await file.read()
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        tmp.write(data)
        tmp.flush()
        tmp.close()
        with open(tmp.name, "rb") as f:
            result = await openai_client.audio.transcriptions.create(
                file=f,
                model="whisper-1",
                response_format="json",
                language=LANG_ISO.get(lang, "fr"),
            )
        text = getattr(result, "text", None)
        if text is None and isinstance(result, dict):
            text = result.get("text", "")
        return {"text": (text or "").strip()}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Transcription impossible: {e}")
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass


@api_router.get("/")
async def root():
    return {"message": "MaghrebTraduction API"}


# ---------------------------------------------------------------------------
# App wiring
# ---------------------------------------------------------------------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("username", unique=True, sparse=True)
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("apple_sub", unique=True, sparse=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.tts_cache.create_index("key", unique=True)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
