"""Full backend API tests for MaghrebTalk."""
import io
import os
import time
import wave
import struct
import math
import requests
import pytest

from conftest import BASE_URL, FREE_TOKEN, PREMIUM_TOKEN, FREE_USER_ID, PREMIUM_USER_ID


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
class TestHealth:
    def test_root(self):
        r = requests.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert "message" in r.json()


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class TestAuth:
    def test_me_without_token_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401, f"Expected 401 (not 403), got {r.status_code}"

    def test_me_with_bad_token_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/auth/me",
                         headers={"Authorization": "Bearer definitely-not-valid-xyz"})
        assert r.status_code == 401

    def test_me_free_user(self, free_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=free_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == FREE_USER_ID
        assert data["email"] == "test@maghrebtalk.app"
        assert data["is_premium"] is False

    def test_me_premium_user(self, premium_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=premium_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == PREMIUM_USER_ID
        assert data["is_premium"] is True


# ---------------------------------------------------------------------------
# Usage / Quota
# ---------------------------------------------------------------------------
class TestUsage:
    def test_usage_free_default(self, free_headers, reset_free_usage):
        r = requests.get(f"{BASE_URL}/api/usage", headers=free_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["limit"] == 3
        assert data["is_premium"] is False
        assert data["used"] == 0
        assert data["remaining"] == 3
        assert "resets_at" in data

    def test_usage_premium_unlimited(self, premium_headers):
        r = requests.get(f"{BASE_URL}/api/usage", headers=premium_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["is_premium"] is True
        assert data["remaining"] == -1


# ---------------------------------------------------------------------------
# Translation
# ---------------------------------------------------------------------------
class TestTranslate:
    def test_translate_fr_to_ma(self, premium_headers):
        r = requests.post(f"{BASE_URL}/api/translate", headers=premium_headers,
                          json={"text": "Bonjour, comment vas-tu ?",
                                "source_lang": "fr", "target_lang": "ma"}, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["translated_text"], "translated_text must not be empty"
        # arabic script presence check
        assert any('\u0600' <= ch <= '\u06FF' for ch in data["translated_text"]), \
            f"Expected arabic script in ma output, got: {data['translated_text']!r}"
        assert isinstance(data["phonetic"], str) and data["phonetic"], "phonetic should be provided for dialect target"
        assert "usage" in data

    def test_translate_ma_to_fr_phonetic_empty(self, premium_headers):
        r = requests.post(f"{BASE_URL}/api/translate", headers=premium_headers,
                          json={"text": "صباح الخير، كيف داير؟",
                                "source_lang": "ma", "target_lang": "fr"}, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["translated_text"]
        assert data["phonetic"] == ""

    def test_translate_fr_to_dz(self, premium_headers):
        r = requests.post(f"{BASE_URL}/api/translate", headers=premium_headers,
                          json={"text": "Bonjour mon ami",
                                "source_lang": "fr", "target_lang": "dz"}, timeout=60)
        assert r.status_code == 200
        data = r.json()
        assert data["target_lang"] == "dz"
        assert any('\u0600' <= ch <= '\u06FF' for ch in data["translated_text"])

    def test_translate_fr_to_tn(self, premium_headers):
        r = requests.post(f"{BASE_URL}/api/translate", headers=premium_headers,
                          json={"text": "Où est le restaurant ?",
                                "source_lang": "fr", "target_lang": "tn"}, timeout=60)
        assert r.status_code == 200
        data = r.json()
        assert data["target_lang"] == "tn"
        assert any('\u0600' <= ch <= '\u06FF' for ch in data["translated_text"])

    def test_translate_latin_arabic_with_digits(self, premium_headers):
        """LLM must understand 'wa7ed' / '3lash' latin-arabic style input."""
        r = requests.post(f"{BASE_URL}/api/translate", headers=premium_headers,
                          json={"text": "wa7ed 3lash rak temchi?",
                                "source_lang": "ma", "target_lang": "fr"}, timeout=60)
        assert r.status_code == 200
        data = r.json()
        assert data["translated_text"], "Should translate arabizi input to french"

    def test_translate_invalid_lang(self, premium_headers):
        r = requests.post(f"{BASE_URL}/api/translate", headers=premium_headers,
                          json={"text": "hi", "source_lang": "en", "target_lang": "ma"})
        assert r.status_code == 400

    def test_translate_empty_text(self, premium_headers):
        r = requests.post(f"{BASE_URL}/api/translate", headers=premium_headers,
                          json={"text": "   ", "source_lang": "fr", "target_lang": "ma"})
        assert r.status_code == 400

    def test_translate_without_token(self):
        r = requests.post(f"{BASE_URL}/api/translate",
                          json={"text": "Bonjour", "source_lang": "fr", "target_lang": "ma"})
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Free quota / 429
# ---------------------------------------------------------------------------
class TestQuota:
    def test_free_user_meters_but_no_backend_429(self, free_headers, reset_free_usage):
        """Backend meters usage but MUST NOT hard-block with 429.
        Gating is client-side (RevenueCat entitlement OR backend usage flag)."""
        for i in range(3):
            r = requests.post(f"{BASE_URL}/api/translate", headers=free_headers,
                              json={"text": f"Bonjour numero {i+1}",
                                    "source_lang": "fr", "target_lang": "ma"}, timeout=60)
            assert r.status_code == 200, f"call {i+1}: {r.status_code} {r.text}"
            usage = r.json()["usage"]
            assert usage["used"] == i + 1
            assert usage["remaining"] == max(0, 3 - (i + 1))

        # 4th call must NOT be 429 (client-side gating only)
        r = requests.post(f"{BASE_URL}/api/translate", headers=free_headers,
                          json={"text": "Encore une fois",
                                "source_lang": "fr", "target_lang": "ma"}, timeout=60)
        assert r.status_code == 200, (
            f"/api/translate over-limit must be 200 (client-side gating), got "
            f"{r.status_code}: {r.text}"
        )
        usage = r.json()["usage"]
        # remaining stays 0 for a free user past the limit
        assert usage["remaining"] == 0
        assert usage["used"] >= 4

    def test_premium_unlimited(self, premium_headers):
        # Just fire 4 quickly, all should succeed (idempotent enough to validate no 429)
        for i in range(4):
            r = requests.post(f"{BASE_URL}/api/translate", headers=premium_headers,
                              json={"text": f"Test premium {i}",
                                    "source_lang": "fr", "target_lang": "ma"}, timeout=60)
            assert r.status_code == 200, f"premium call {i}: {r.status_code}"
            assert r.json()["usage"]["remaining"] == -1


# ---------------------------------------------------------------------------
# TTS
# ---------------------------------------------------------------------------
class TestTTS:
    def test_tts_generate_and_fetch(self, premium_headers):
        r = requests.post(f"{BASE_URL}/api/tts", headers=premium_headers,
                          json={"text": "Salam, kif dayr?", "lang": "ma"}, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "url" in data and data["url"].startswith("/api/tts/") and data["url"].endswith(".mp3")

        audio_url = f"{BASE_URL}{data['url']}"
        r2 = requests.get(audio_url, timeout=30)
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("audio/mpeg")
        assert len(r2.content) > 500

    def test_tts_empty_text(self, premium_headers):
        r = requests.post(f"{BASE_URL}/api/tts", headers=premium_headers,
                          json={"text": "", "lang": "ma"})
        assert r.status_code == 400

    def test_tts_unauthenticated(self):
        r = requests.post(f"{BASE_URL}/api/tts", json={"text": "hi", "lang": "ma"})
        assert r.status_code == 401

    def test_tts_missing_returns_404(self):
        r = requests.get(f"{BASE_URL}/api/tts/deadbeef_notfound.mp3")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------
class TestHistory:
    def test_history_flow(self, premium_headers, mongo_db):
        # Clean baseline
        mongo_db.history.delete_many({"user_id": PREMIUM_USER_ID})
        # Create one translation → should land in history
        tr = requests.post(f"{BASE_URL}/api/translate", headers=premium_headers,
                           json={"text": "Merci beaucoup",
                                 "source_lang": "fr", "target_lang": "ma"}, timeout=60)
        assert tr.status_code == 200
        entry_id = tr.json()["id"]

        r = requests.get(f"{BASE_URL}/api/history", headers=premium_headers)
        assert r.status_code == 200
        history = r.json()
        assert isinstance(history, list)
        assert any(h["id"] == entry_id for h in history)

        # Delete specific
        d = requests.delete(f"{BASE_URL}/api/history/{entry_id}", headers=premium_headers)
        assert d.status_code == 200
        r2 = requests.get(f"{BASE_URL}/api/history", headers=premium_headers)
        assert all(h["id"] != entry_id for h in r2.json())

        # Add two more and clear all
        for i in range(2):
            requests.post(f"{BASE_URL}/api/translate", headers=premium_headers,
                          json={"text": f"clear test {i}", "source_lang": "fr", "target_lang": "ma"}, timeout=60)
        clr = requests.delete(f"{BASE_URL}/api/history", headers=premium_headers)
        assert clr.status_code == 200
        assert requests.get(f"{BASE_URL}/api/history", headers=premium_headers).json() == []


# ---------------------------------------------------------------------------
# Favorites
# ---------------------------------------------------------------------------
class TestFavorites:
    def test_favorites_idempotent_flow(self, premium_headers, mongo_db):
        mongo_db.favorites.delete_many({"user_id": PREMIUM_USER_ID})
        payload = {
            "source_text": "Merci beaucoup",
            "translated_text": "شكرا بزاف",
            "phonetic": "Choukran bezzaf",
            "source_lang": "fr", "target_lang": "ma",
        }
        a = requests.post(f"{BASE_URL}/api/favorites", headers=premium_headers, json=payload)
        assert a.status_code == 200
        fav_id = a.json()["id"]
        # Re-post same -> no duplicate
        b = requests.post(f"{BASE_URL}/api/favorites", headers=premium_headers, json=payload)
        assert b.status_code == 200
        assert b.json()["id"] == fav_id, "Idempotency broken - second POST returned new id"

        lst = requests.get(f"{BASE_URL}/api/favorites", headers=premium_headers).json()
        assert len([f for f in lst if f["source_text"] == payload["source_text"]]) == 1

        d = requests.delete(f"{BASE_URL}/api/favorites/{fav_id}", headers=premium_headers)
        assert d.status_code == 200
        after = requests.get(f"{BASE_URL}/api/favorites", headers=premium_headers).json()
        assert all(f["id"] != fav_id for f in after)


# ---------------------------------------------------------------------------
# Expressions
# ---------------------------------------------------------------------------
class TestExpressions:
    def test_get_expressions_structure(self):
        r = requests.get(f"{BASE_URL}/api/expressions")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 3
        for cat in data:
            assert "category" in cat and "items" in cat
            for item in cat["items"]:
                assert "fr" in item
                for lang in ["ma", "dz", "tn"]:
                    assert lang in item["translations"], f"missing {lang} in {item.get('fr')}"
                    tr = item["translations"][lang]
                    assert tr.get("text")
                    assert "phonetic" in tr


# ---------------------------------------------------------------------------
# Transcribe (STT)
# ---------------------------------------------------------------------------
def _make_silent_wav_bytes(duration_s: float = 0.5, rate: int = 16000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        # ~440Hz tone (whisper often returns empty on silence, tone is safer)
        frames = bytearray()
        for i in range(int(rate * duration_s)):
            v = int(3000 * math.sin(2 * math.pi * 440 * (i / rate)))
            frames += struct.pack("<h", v)
        w.writeframes(bytes(frames))
    return buf.getvalue()


class TestTranscribe:
    def test_transcribe_requires_file(self, premium_headers):
        h = {"Authorization": premium_headers["Authorization"]}
        r = requests.post(f"{BASE_URL}/api/transcribe", headers=h, data={"lang": "fr"})
        # FastAPI returns 422 when required file missing
        assert r.status_code in (400, 422)

    def test_transcribe_unauthenticated(self):
        wav = _make_silent_wav_bytes()
        r = requests.post(f"{BASE_URL}/api/transcribe",
                          files={"file": ("t.wav", wav, "audio/wav")},
                          data={"lang": "fr"})
        assert r.status_code == 401

    def test_transcribe_with_tone_wav(self, premium_headers):
        h = {"Authorization": premium_headers["Authorization"]}
        wav = _make_silent_wav_bytes(duration_s=1.0)
        r = requests.post(f"{BASE_URL}/api/transcribe", headers=h,
                          files={"file": ("t.wav", wav, "audio/wav")},
                          data={"lang": "fr"}, timeout=60)
        # Endpoint should either transcribe or gracefully report 502; must not 500
        assert r.status_code in (200, 502), f"unexpected {r.status_code}: {r.text}"
        if r.status_code == 200:
            assert "text" in r.json()
