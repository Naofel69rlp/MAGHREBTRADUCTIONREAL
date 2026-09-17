"""Apple Sign-In endpoint tests + regression sanity for existing auth/translate.

The `/api/auth/apple` endpoint verifies an Apple identity_token against Apple's
JWKS (RS256, issuer https://appleid.apple.com, aud in APPLE_AUDIENCES).
Since real Apple tokens require a physical iOS device, we only verify the
rejection paths here (bogus token, self-signed token, missing field), plus
regression on existing endpoints not broken by the new imports/code.
"""
import time
import requests
import pytest
import jwt as pyjwt
from cryptography.hazmat.primitives.asymmetric import rsa

from conftest import BASE_URL, FREE_TOKEN, PREMIUM_TOKEN, FREE_USER_ID, PREMIUM_USER_ID


APPLE_URL = f"{BASE_URL}/api/auth/apple"


# ---------------------------------------------------------------------------
# Apple auth - rejection paths
# ---------------------------------------------------------------------------
class TestAppleAuthRejection:
    def test_bogus_token_string_returns_401_not_500(self):
        """Non-JWT garbage must return 401, never 500."""
        r = requests.post(APPLE_URL, json={"identity_token": "not.a.real.token"}, timeout=15)
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"
        body = r.json()
        assert "detail" in body
        assert "apple" in body["detail"].lower() or "invalide" in body["detail"].lower()

    def test_random_garbage_token_returns_401(self):
        r = requests.post(APPLE_URL, json={"identity_token": "xyzxyzxyz"}, timeout=15)
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"

    def test_empty_token_returns_401(self):
        r = requests.post(APPLE_URL, json={"identity_token": ""}, timeout=15)
        # Empty string still passes Pydantic (str), so endpoint should reject it -> 401
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"

    def test_self_signed_jwt_wrong_signature_returns_401(self):
        """A syntactically valid RS256 JWT NOT signed by Apple must be rejected 401."""
        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        now = int(time.time())
        claims = {
            "iss": "https://appleid.apple.com",
            "aud": "com.emergent.darijachat.mhdwef",
            "sub": "000123.deadbeef.4242",
            "iat": now,
            "exp": now + 3600,
            "email": "fake@privaterelay.appleid.com",
        }
        token = pyjwt.encode(
            claims,
            private_key,
            algorithm="RS256",
            headers={"kid": "not-an-apple-kid"},
        )
        r = requests.post(APPLE_URL, json={"identity_token": token}, timeout=15)
        assert r.status_code == 401, f"Expected 401 for self-signed token, got {r.status_code}: {r.text}"
        assert "detail" in r.json()

    def test_self_signed_jwt_wrong_audience_returns_401(self):
        """Self-signed JWT with wrong audience - still 401 because JWKS lookup fails first."""
        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        now = int(time.time())
        claims = {
            "iss": "https://appleid.apple.com",
            "aud": "com.some.other.app",  # wrong audience
            "sub": "000123.aaaa.1111",
            "iat": now,
            "exp": now + 3600,
        }
        token = pyjwt.encode(claims, private_key, algorithm="RS256",
                             headers={"kid": "fake-kid-xyz"})
        r = requests.post(APPLE_URL, json={"identity_token": token}, timeout=15)
        assert r.status_code == 401, f"Expected 401 for wrong aud, got {r.status_code}: {r.text}"

    def test_missing_identity_token_returns_422(self):
        """Pydantic must reject missing required field with 422."""
        r = requests.post(APPLE_URL, json={}, timeout=15)
        assert r.status_code == 422, f"Expected 422 validation error, got {r.status_code}: {r.text}"

    def test_null_identity_token_returns_422(self):
        r = requests.post(APPLE_URL, json={"identity_token": None}, timeout=15)
        assert r.status_code == 422, f"Expected 422, got {r.status_code}: {r.text}"

    def test_wrong_type_identity_token_returns_422(self):
        r = requests.post(APPLE_URL, json={"identity_token": 12345}, timeout=15)
        assert r.status_code == 422, f"Expected 422, got {r.status_code}: {r.text}"

    def test_bogus_token_never_creates_user(self, mongo_db):
        """Verify no user was persisted after failed Apple auth attempts."""
        # Just confirm no leftover Apple users created by the above garbage attempts
        leaked = list(mongo_db.users.find(
            {"apple_sub": {"$in": ["000123.deadbeef.4242", "000123.aaaa.1111"]}}
        ))
        assert leaked == [], f"Apple user should not be created from rejected tokens: {leaked}"


# ---------------------------------------------------------------------------
# Regression - Existing auth flows must still work after Apple code added
# ---------------------------------------------------------------------------
class TestExistingAuthRegression:
    def test_me_no_token_still_401(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_free_user_still_200(self, free_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=free_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == FREE_USER_ID
        assert data["is_premium"] is False
        assert data["email"] == "test@maghrebtalk.app"

    def test_me_premium_user_still_200(self, premium_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=premium_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == PREMIUM_USER_ID
        assert data["is_premium"] is True

    def test_usage_premium_still_unlimited(self, premium_headers):
        r = requests.get(f"{BASE_URL}/api/usage", headers=premium_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["is_premium"] is True
        assert data["remaining"] == -1

    def test_translate_fr_to_ma_still_works(self, premium_headers):
        r = requests.post(
            f"{BASE_URL}/api/translate",
            headers=premium_headers,
            json={"text": "Bonjour", "source_lang": "fr", "target_lang": "ma"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["translated_text"]
        assert any('\u0600' <= ch <= '\u06FF' for ch in data["translated_text"])
        assert "usage" in data


# ---------------------------------------------------------------------------
# Startup / index sanity
# ---------------------------------------------------------------------------
class TestStartupSanity:
    def test_root_alive(self):
        r = requests.get(f"{BASE_URL}/api/", timeout=15)
        assert r.status_code == 200

    def test_apple_sub_sparse_unique_index_exists(self, mongo_db):
        """Confirm startup created the sparse unique apple_sub index without crash."""
        idx = mongo_db.users.index_information()
        # Find any index whose key contains apple_sub
        apple_idx = None
        for name, info in idx.items():
            keys = [k for k, _ in info.get("key", [])]
            if "apple_sub" in keys:
                apple_idx = info
                break
        assert apple_idx is not None, f"apple_sub index not found. Indexes: {list(idx.keys())}"
        assert apple_idx.get("unique") is True, f"apple_sub index must be unique: {apple_idx}"
        assert apple_idx.get("sparse") is True, f"apple_sub index must be sparse: {apple_idx}"
