"""Iteration 5 — global AI chat endpoints (POST /api/ai/ask, GET /api/ai/suggestions)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://cater-insight.preview.emergentagent.com").rstrip("/")

CONTEXTS = ["dashboard", "inventory", "expenses", "staff", "menu"]


@pytest.fixture(scope="module")
def auth():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    email = f"TEST_iter5_{uuid.uuid4().hex[:8]}@restaurant.com"
    r = s.post(f"{BASE_URL}/api/auth/demo-login", json={"email": email, "name": "TEST iter5"})
    assert r.status_code == 200, r.text
    token = r.json()["session_token"]
    return {"headers": {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}}


# ============ AI SUGGESTIONS ============
class TestAiSuggestions:
    @pytest.mark.parametrize("ctx", CONTEXTS)
    def test_suggestions_each_context(self, ctx):
        r = requests.get(f"{BASE_URL}/api/ai/suggestions", params={"context": ctx}, timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "suggestions" in j
        assert isinstance(j["suggestions"], list) and len(j["suggestions"]) == 3
        for s in j["suggestions"]:
            assert isinstance(s, str) and len(s) > 0

    def test_suggestions_unknown_falls_back(self):
        r = requests.get(f"{BASE_URL}/api/ai/suggestions", params={"context": "bogus"}, timeout=15)
        assert r.status_code == 200
        # unknown context falls back to dashboard
        assert r.json()["suggestions"] == requests.get(
            f"{BASE_URL}/api/ai/suggestions", params={"context": "dashboard"}
        ).json()["suggestions"]

    def test_suggestions_default(self):
        r = requests.get(f"{BASE_URL}/api/ai/suggestions", timeout=15)
        assert r.status_code == 200
        assert len(r.json()["suggestions"]) == 3


# ============ AI ASK ============
class TestAiAsk:
    def test_ask_unauth_401(self):
        r = requests.post(f"{BASE_URL}/api/ai/ask",
                          json={"context": "dashboard", "question": "hi"}, timeout=30)
        assert r.status_code == 401

    @pytest.mark.parametrize("ctx", CONTEXTS)
    def test_ask_each_context(self, auth, ctx):
        r = requests.post(
            f"{BASE_URL}/api/ai/ask",
            json={"context": ctx, "question": f"Give me a very brief {ctx} summary."},
            headers=auth["headers"], timeout=90,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["context"] == ctx
        assert isinstance(j["answer"], str) and len(j["answer"].strip()) > 0

    def test_ask_unknown_context_falls_back_to_dashboard(self, auth):
        r = requests.post(
            f"{BASE_URL}/api/ai/ask",
            json={"context": "nonsense", "question": "Summarise today sales"},
            headers=auth["headers"], timeout=90,
        )
        assert r.status_code == 200, r.text
        assert r.json()["context"] == "dashboard"
        assert len(r.json()["answer"].strip()) > 0

    def test_ask_missing_fields_422(self, auth):
        r = requests.post(f"{BASE_URL}/api/ai/ask", json={"context": "dashboard"},
                          headers=auth["headers"], timeout=15)
        assert r.status_code == 422


# ============ REGRESSION (previous endpoints still up) ============
class TestRegression:
    def test_branches_still_ok(self, auth):
        r = requests.get(f"{BASE_URL}/api/branches", headers=auth["headers"], timeout=15)
        assert r.status_code == 200 and len(r.json()) == 3

    def test_dashboard_summary_still_ok(self, auth):
        r = requests.get(f"{BASE_URL}/api/dashboard/summary", headers=auth["headers"], timeout=15)
        assert r.status_code == 200
        assert "kpis" in r.json()

    def test_inventory_list_still_ok(self, auth):
        r = requests.get(f"{BASE_URL}/api/inventory", headers=auth["headers"], timeout=15)
        assert r.status_code == 200 and len(r.json()) > 0

    def test_expenses_still_ok(self, auth):
        r = requests.get(f"{BASE_URL}/api/expenses", headers=auth["headers"], timeout=15)
        assert r.status_code == 200 and "items" in r.json()

    def test_employees_still_ok(self, auth):
        r = requests.get(f"{BASE_URL}/api/employees", headers=auth["headers"], timeout=15)
        assert r.status_code == 200 and r.json()["total_employees"] > 0

    def test_menu_still_ok(self, auth):
        r = requests.get(f"{BASE_URL}/api/menu/analytics", headers=auth["headers"], timeout=15)
        assert r.status_code == 200 and len(r.json()["items"]) > 0

    def test_integrations_history_still_ok(self, auth):
        r = requests.get(f"{BASE_URL}/api/integrations/history", headers=auth["headers"], timeout=15)
        assert r.status_code == 200 and "items" in r.json()

    def test_profile_patch_still_ok(self, auth):
        r = requests.patch(f"{BASE_URL}/api/profile", json={"business_name": "TEST_iter5_biz"},
                           headers=auth["headers"], timeout=15)
        assert r.status_code == 200 and r.json()["business_name"] == "TEST_iter5_biz"
