import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8000").rstrip("/")
FREE_TOKEN = "test-token-maghrebtalk-123"
PREMIUM_TOKEN = "test-token-premium-123"
FREE_USER_ID = "user_testmaghreb1"
PREMIUM_USER_ID = "user_testpremium1"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def free_headers():
    return {"Authorization": f"Bearer {FREE_TOKEN}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def premium_headers():
    return {"Authorization": f"Bearer {PREMIUM_TOKEN}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def mongo_db():
    c = MongoClient(MONGO_URL)
    db = c[DB_NAME]
    yield db
    c.close()


@pytest.fixture
def reset_free_usage(mongo_db):
    mongo_db.usage.delete_many({"user_id": FREE_USER_ID})
    yield
