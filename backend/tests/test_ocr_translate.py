"""OCR-Translate contract + downstream chain (TTS/History) tests.

Verifies fix for the 422 issue: /api/ocr-translate now returns
source_text/translated_text (aligned with TranslationResult contract),
so subsequent /api/tts and /api/history calls no longer 422.
"""
import base64
import io
import os
import time

import pytest
import requests

from conftest import BASE_URL, FREE_TOKEN, PREMIUM_TOKEN, FREE_USER_ID


# ---------------------------------------------------------------------------
# Helpers: image fixtures
# ---------------------------------------------------------------------------
def _load_text_image_b64() -> str:
    """Return a base64 JPEG containing readable text.

    Prefers /tmp/img_b64.txt (seeded by main agent). Falls back to PIL.
    """
    path = "/tmp/img_b64.txt"
    if os.path.exists(path):
        with open(path, "r") as f:
            data = f.read().strip()
        if data.startswith("data:") and "," in data:
            data = data.split(",", 1)[1]
        return data
    # Fallback: render "Bonjour" on a white canvas
    from PIL import Image, ImageDraw, ImageFont
    img = Image.new("RGB", (400, 160), "white")
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 60)
    except Exception:
        font = ImageFont.load_default()
    d.text((20, 40), "Bonjour", fill="black", font=font)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return base64.b64encode(buf.getvalue()).decode()


def _blank_image_b64() -> str:
    from PIL import Image
    img = Image.new("RGB", (400, 300), "white")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return base64.b64encode(buf.getvalue()).decode()


@pytest.fixture(scope="module")
def text_image_b64():
    return _load_text_image_b64()


@pytest.fixture(scope="module")
def blank_image_b64():
    return _blank_image_b64()


@pytest.fixture(scope="session")
def reset_free_usage_direct(mongo_db):
    """Clean the free user's usage counter before quota tests."""
    mongo_db.usage.delete_many({"user_id": FREE_USER_ID})
    yield
    mongo_db.usage.delete_many({"user_id": FREE_USER_ID})


# ---------------------------------------------------------------------------
# 1. Contract: response shape after fix
# ---------------------------------------------------------------------------
class TestOcrContract:
    """POST /api/ocr-translate must return source_text/translated_text,
    NOT detected_text/translation (the pre-fix keys)."""

    def test_ocr_contract_target_ma(self, premium_headers, text_image_b64):
        r = requests.post(
            f"{BASE_URL}/api/ocr-translate",
            headers=premium_headers,
            json={"image_base64": text_image_b64, "target_lang": "ma"},
            timeout=120,
        )
        assert r.status_code == 200, r.text
        data = r.json()

        # New contract keys must be present
        for key in ("source_text", "translated_text", "phonetic",
                    "source_lang", "target_lang", "no_text", "usage"):
            assert key in data, f"Missing '{key}' in response: {data.keys()}"

        # Old keys must NOT be present (the bug we fixed)
        assert "detected_text" not in data, "Legacy key 'detected_text' still present"
        assert "translation" not in data, "Legacy key 'translation' still present"

        assert data["target_lang"] == "ma"
        # For dialect target, phonetic should be non-empty when text was detected
        if not data["no_text"]:
            assert data["translated_text"], "translated_text must not be empty for ma target"
            assert data["phonetic"], "phonetic must be non-empty for ma target"

    def test_ocr_contract_target_en_empty_phonetic(self, premium_headers, text_image_b64):
        r = requests.post(
            f"{BASE_URL}/api/ocr-translate",
            headers=premium_headers,
            json={"image_base64": text_image_b64, "target_lang": "en"},
            timeout=120,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["target_lang"] == "en"
        assert "source_text" in data and "translated_text" in data
        if not data["no_text"]:
            assert data["phonetic"] == "", (
                f"phonetic must be empty for non-dialect target, got: {data['phonetic']!r}"
            )

    def test_ocr_unauthenticated(self, text_image_b64):
        r = requests.post(
            f"{BASE_URL}/api/ocr-translate",
            json={"image_base64": text_image_b64, "target_lang": "ma"},
        )
        assert r.status_code == 401

    def test_ocr_invalid_target_lang(self, premium_headers, text_image_b64):
        r = requests.post(
            f"{BASE_URL}/api/ocr-translate",
            headers=premium_headers,
            json={"image_base64": text_image_b64, "target_lang": "zz"},
        )
        assert r.status_code == 400

    def test_ocr_missing_image(self, premium_headers):
        r = requests.post(
            f"{BASE_URL}/api/ocr-translate",
            headers=premium_headers,
            json={"image_base64": "", "target_lang": "ma"},
        )
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# 2. Chain: OCR -> TTS  (previously 422)
# ---------------------------------------------------------------------------
class TestOcrToTtsChain:
    def test_ocr_output_feeds_tts(self, premium_headers, text_image_b64):
        r = requests.post(
            f"{BASE_URL}/api/ocr-translate",
            headers=premium_headers,
            json={"image_base64": text_image_b64, "target_lang": "ma"},
            timeout=120,
        )
        assert r.status_code == 200, r.text
        ocr = r.json()
        if ocr["no_text"] or not ocr["translated_text"]:
            pytest.skip("OCR did not detect text in the seeded image; cannot chain to TTS")

        tts = requests.post(
            f"{BASE_URL}/api/tts",
            headers=premium_headers,
            json={"text": ocr["translated_text"], "lang": ocr["target_lang"]},
            timeout=60,
        )
        assert tts.status_code == 200, (
            f"Chained TTS should be 200, got {tts.status_code}: {tts.text}"
        )
        body = tts.json()
        assert "url" in body and body["url"].startswith("/api/tts/") and body["url"].endswith(".mp3")


# ---------------------------------------------------------------------------
# 3. Chain: OCR -> History  (previously 422)
# ---------------------------------------------------------------------------
class TestOcrToHistoryChain:
    def test_ocr_output_feeds_history(self, premium_headers, text_image_b64):
        r = requests.post(
            f"{BASE_URL}/api/ocr-translate",
            headers=premium_headers,
            json={"image_base64": text_image_b64, "target_lang": "ma"},
            timeout=120,
        )
        assert r.status_code == 200, r.text
        ocr = r.json()
        if ocr["no_text"] or not ocr["translated_text"]:
            pytest.skip("OCR did not detect text; cannot chain to history")

        payload = {
            "source_text": ocr["source_text"],
            "translated_text": ocr["translated_text"],
            "phonetic": ocr["phonetic"],
            "source_lang": ocr["source_lang"] or "fr",
            "target_lang": ocr["target_lang"],
        }
        h = requests.post(f"{BASE_URL}/api/history", headers=premium_headers, json=payload)
        assert h.status_code == 200, (
            f"Chained history POST should be 200, got {h.status_code}: {h.text}"
        )
        echoed = h.json()
        assert echoed["source_text"] == payload["source_text"]
        assert echoed["translated_text"] == payload["translated_text"]
        assert echoed["phonetic"] == payload["phonetic"]
        assert echoed["source_lang"] == payload["source_lang"]
        assert echoed["target_lang"] == payload["target_lang"]
        assert "id" in echoed and echoed["id"]


# ---------------------------------------------------------------------------
# 4. Free-tier quota: ocr-translate counts as 1 AND
#    over-limit call MUST still return 200 (no backend 429 hard-block).
# ---------------------------------------------------------------------------
class TestOcrQuota:
    def test_ocr_no_backend_429_when_over_limit(
        self, free_headers, mongo_db, text_image_b64
    ):
        """RevenueCat gating is now CLIENT-SIDE only. Backend must NOT 429."""
        # Drain the free daily quota via /api/translate (3 calls) then push it
        # one extra (used=4) so the free user is verifiably over limit.
        mongo_db.usage.delete_many({"user_id": FREE_USER_ID})
        for i in range(4):
            r = requests.post(
                f"{BASE_URL}/api/translate",
                headers=free_headers,
                json={"text": f"bonjour {i}", "source_lang": "fr", "target_lang": "ma"},
                timeout=60,
            )
            # /api/translate is not the subject here; if it fails intermittently
            # we still care about the ocr call below.
            assert r.status_code in (200, 502), f"drain {i}: {r.status_code} {r.text}"

        # Confirm state: used>=3, remaining=0, is_premium=false
        usage = requests.get(f"{BASE_URL}/api/usage", headers=free_headers).json()
        assert usage["is_premium"] is False
        assert usage["remaining"] == 0, f"expected remaining=0 after drain, got {usage}"

        # THE fix under review: over-limit free user hits OCR -> must be 200,
        # NOT 429 (previous behavior).
        r = requests.post(
            f"{BASE_URL}/api/ocr-translate",
            headers=free_headers,
            json={"image_base64": text_image_b64, "target_lang": "ma"},
            timeout=120,
        )
        assert r.status_code == 200, (
            f"OCR over-limit MUST return 200 (client-side gating only), "
            f"got {r.status_code}: {r.text}"
        )
        body = r.json()
        # Response must still carry the standard contract.
        for key in ("source_text", "translated_text", "phonetic",
                    "source_lang", "target_lang", "no_text", "usage"):
            assert key in body, f"Missing '{key}' in over-limit OCR response"

        if not body.get("no_text"):
            assert body["translated_text"], (
                "over-limit OCR should still translate text when detected"
            )

        # Cleanup
        mongo_db.usage.delete_many({"user_id": FREE_USER_ID})

    def test_ocr_free_user_meters_usage(self, free_headers, mongo_db, text_image_b64):
        """OCR should still increment usage for free users (contract preserved)."""
        mongo_db.usage.delete_many({"user_id": FREE_USER_ID})

        r = requests.post(
            f"{BASE_URL}/api/ocr-translate",
            headers=free_headers,
            json={"image_base64": text_image_b64, "target_lang": "ma"},
            timeout=120,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        if body.get("no_text"):
            pytest.skip("Seeded image not detected as text; cannot validate metering")
        assert body["usage"]["used"] == 1
        assert body["usage"]["remaining"] == 2

        mongo_db.usage.delete_many({"user_id": FREE_USER_ID})


# ---------------------------------------------------------------------------
# 5. No-text image does not consume quota
# ---------------------------------------------------------------------------
class TestOcrNoTextNoQuota:
    def test_blank_image_no_quota_consumed(self, free_headers, mongo_db, blank_image_b64):
        mongo_db.usage.delete_many({"user_id": FREE_USER_ID})

        before = requests.get(f"{BASE_URL}/api/usage", headers=free_headers).json()
        assert before["used"] == 0

        r = requests.post(
            f"{BASE_URL}/api/ocr-translate",
            headers=free_headers,
            json={"image_base64": blank_image_b64, "target_lang": "ma"},
            timeout=120,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        # Either explicit no_text flag OR empty translated_text
        assert body.get("no_text") is True or not body.get("translated_text"), (
            f"Blank image should be flagged no_text or empty translation, got: {body}"
        )

        after = requests.get(f"{BASE_URL}/api/usage", headers=free_headers).json()
        assert after["used"] == before["used"], (
            f"Quota was consumed on a no-text image! used before={before['used']} after={after['used']}"
        )

        mongo_db.usage.delete_many({"user_id": FREE_USER_ID})
