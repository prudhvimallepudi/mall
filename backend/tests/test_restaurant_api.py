"""Restaurant Management API tests (iteration 2 — Profile module + AI)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://cater-insight.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth(session):
    """Demo-login creates a unique test user with seed data."""
    email = f"TEST_profile_{uuid.uuid4().hex[:8]}@restaurant.com"
    r = session.post(f"{BASE_URL}/api/auth/demo-login",
                     json={"email": email, "name": "TEST Profile Owner"})
    assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "session_token" in data and "user" in data
    token = data["session_token"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    return {"email": email, "token": token, "user": data["user"], "headers": headers}


# ================= AUTH =================
class TestAuth:
    def test_demo_login_creates_user(self, session):
        email = f"TEST_login_{uuid.uuid4().hex[:6]}@r.com"
        r = session.post(f"{BASE_URL}/api/auth/demo-login", json={"email": email, "name": "X"})
        assert r.status_code == 200
        j = r.json()
        assert j["user"]["email"] == email
        assert j["session_token"].startswith("demo_")

    def test_me_returns_profile_fields(self, session, auth):
        r = session.get(f"{BASE_URL}/api/auth/me", headers=auth["headers"])
        assert r.status_code == 200
        me = r.json()
        for k in ("user_id", "email", "name"):
            assert k in me
        # New optional fields must be present in schema (even if None)
        for k in ("avatar_id", "business_name", "gst_number", "logo_url"):
            assert k in me

    def test_me_unauth(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401


# ================= PROFILE (NEW) =================
class TestProfile:
    def test_patch_profile_updates(self, session, auth):
        payload = {
            "name": "Updated Owner",
            "avatar_id": "chef",
            "business_name": "Spice Garden",
            "gst_number": "22AAAAA0000A1Z5",
            "logo_url": "https://example.com/logo.png",
        }
        r = session.patch(f"{BASE_URL}/api/profile", json=payload, headers=auth["headers"])
        assert r.status_code == 200, r.text
        body = r.json()
        for k, v in payload.items():
            assert body[k] == v, f"mismatch on {k}: {body.get(k)}"

        # Verify persistence via /auth/me
        r2 = session.get(f"{BASE_URL}/api/auth/me", headers=auth["headers"])
        me = r2.json()
        assert me["avatar_id"] == "chef"
        assert me["business_name"] == "Spice Garden"

    def test_patch_profile_empty_body_400(self, session, auth):
        r = session.patch(f"{BASE_URL}/api/profile", json={}, headers=auth["headers"])
        assert r.status_code == 400

    def test_patch_profile_unauth(self):
        r = requests.patch(f"{BASE_URL}/api/profile", json={"name": "x"})
        assert r.status_code == 401


# ================= BRANCHES / DASHBOARD =================
class TestBranchesDashboard:
    def test_branches_seeded(self, session, auth):
        r = session.get(f"{BASE_URL}/api/branches", headers=auth["headers"])
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list) and len(arr) == 3
        assert all("branch_id" in b and "name" in b for b in arr)

    def test_dashboard_summary(self, session, auth):
        r = session.get(f"{BASE_URL}/api/dashboard/summary", headers=auth["headers"])
        assert r.status_code == 200
        j = r.json()
        for k in ("kpis", "sales_7d", "payment_modes", "top_items"):
            assert k in j
        for kpi in ("today_sales", "today_orders", "avg_ticket", "profit_30d", "low_stock_count"):
            assert kpi in j["kpis"]
        assert len(j["sales_7d"]) == 7

    def test_dashboard_reports_daily(self, session, auth):
        r = session.get(f"{BASE_URL}/api/dashboard/reports?period=daily", headers=auth["headers"])
        assert r.status_code == 200
        j = r.json()
        assert j["period"] == "daily"
        assert isinstance(j["points"], list) and len(j["points"]) > 0


# ================= INVENTORY =================
class TestInventory:
    def test_list_inventory(self, session, auth):
        r = session.get(f"{BASE_URL}/api/inventory", headers=auth["headers"])
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list) and len(arr) > 0

    def test_add_and_adjust_inventory(self, session, auth):
        payload = {"name": "TEST_Flour", "unit": "kg", "stock": 10.0, "min_stock": 2.0, "cost_per_unit": 50.0}
        r = session.post(f"{BASE_URL}/api/inventory", json=payload, headers=auth["headers"])
        assert r.status_code == 200, r.text
        item = r.json()
        assert item["name"] == "TEST_Flour"
        iid = item["item_id"]

        r2 = session.patch(f"{BASE_URL}/api/inventory/{iid}/stock", json={"delta": 5.5}, headers=auth["headers"])
        assert r2.status_code == 200
        assert abs(r2.json()["stock"] - 15.5) < 0.01


# ================= EXPENSES =================
class TestExpenses:
    def test_list_expenses(self, session, auth):
        r = session.get(f"{BASE_URL}/api/expenses", headers=auth["headers"])
        assert r.status_code == 200
        j = r.json()
        for k in ("items", "total", "categories"):
            assert k in j

    def test_add_expense(self, session, auth):
        r = session.post(f"{BASE_URL}/api/expenses",
                         json={"category": "Rent", "amount": 1234.5, "note": "TEST_entry"},
                         headers=auth["headers"])
        assert r.status_code == 200, r.text
        e = r.json()
        assert e["category"] == "Rent" and e["amount"] == 1234.5


# ================= MENU =================
class TestMenu:
    def test_menu_analytics(self, session, auth):
        r = session.get(f"{BASE_URL}/api/menu/analytics", headers=auth["headers"])
        assert r.status_code == 200
        j = r.json()
        assert "items" in j and len(j["items"]) > 0
        first = j["items"][0]
        for k in ("name", "revenue", "profit", "margin_pct"):
            assert k in first


# ================= AI INSIGHTS =================
class TestAI:
    def test_ai_insights_structure(self, session, auth):
        r = session.get(f"{BASE_URL}/api/ai/insights", headers=auth["headers"], timeout=60)
        assert r.status_code == 200
        j = r.json()
        assert "insights" in j and "generated_at" in j
        insights = j["insights"]
        assert isinstance(insights, list) and 1 <= len(insights) <= 4
        allowed = {"prediction", "recommendation", "alert", "opportunity"}
        for ins in insights:
            for k in ("type", "title", "message", "impact"):
                assert k in ins
            assert ins["type"] in allowed
