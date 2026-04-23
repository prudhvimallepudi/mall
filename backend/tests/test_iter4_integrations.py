"""
Iteration 4 – Integration tab backend tests.
Covers:
  - POST /api/integrations/parse  (CSV, Excel, PDF, auth, validation)
  - POST /api/integrations/import (sales, expenses, inventory, attendance)
  - GET  /api/integrations/history
"""
import base64
import io
import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests

TODAY = datetime.now(timezone.utc).date()
D1 = TODAY.isoformat()
D2 = (TODAY - timedelta(days=1)).isoformat()
D3 = (TODAY - timedelta(days=2)).isoformat()

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://cater-insight.preview.emergentagent.com").rstrip("/")


# --------------------------- shared fixtures ---------------------------
@pytest.fixture(scope="module")
def auth():
    email = f"TEST_iter4_{uuid.uuid4().hex[:8]}@restaurant.com"
    r = requests.post(f"{BASE_URL}/api/auth/demo-login", json={"email": email, "name": "Iter4 Tester"}, timeout=60)
    assert r.status_code == 200, r.text
    token = r.json()["session_token"]
    return {"headers": {"Authorization": f"Bearer {token}"}, "email": email, "token": token}


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


# --------------------------- CSV parse & import (sales) ---------------------------
SALES_CSV = (
    "date,total,orders,cash,upi,card\n"
    "2025-01-05,12500,42,2500,6500,3500\n"
    "2025-01-06,18200,55,3200,9000,6000\n"
    "2025-01-07,9800,31,1800,5000,3000\n"
)


class TestParseCSVSales:
    def test_parse_csv_sales_success(self, auth):
        payload = {
            "filename": "TEST_sales.csv",
            "content_base64": _b64(SALES_CSV.encode()),
            "mime_type": "text/csv",
            "category": "sales",
        }
        r = requests.post(f"{BASE_URL}/api/integrations/parse", json=payload, headers=auth["headers"], timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["kind"] == "csv"
        assert d["category"] == "sales"
        assert d["total_rows"] == 3
        assert set(d["headers"]) >= {"date", "total", "orders"}
        assert d["upload_id"].startswith("up_")
        # AI mapping should at least map required fields
        assert d["ai_mapping"].get("date") == "date"
        assert d["ai_mapping"].get("total") == "total"
        assert "target_fields" in d and "required_fields" in d
        # Stash for other tests
        pytest.sales_parse = d

    def test_parse_invalid_category(self, auth):
        r = requests.post(
            f"{BASE_URL}/api/integrations/parse",
            json={"filename": "x.csv", "content_base64": _b64(b"a,b\n1,2\n"), "mime_type": "text/csv", "category": "bogus"},
            headers=auth["headers"], timeout=30,
        )
        assert r.status_code == 400

    def test_parse_file_too_large(self, auth):
        # 6 MB payload to trigger 413
        big = b"col\n" + (b"x\n" * (6 * 1024 * 1024 // 2))
        r = requests.post(
            f"{BASE_URL}/api/integrations/parse",
            json={"filename": "big.csv", "content_base64": _b64(big), "mime_type": "text/csv", "category": "sales"},
            headers=auth["headers"], timeout=60,
        )
        assert r.status_code == 413, r.text

    def test_parse_requires_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/integrations/parse",
            json={"filename": "a.csv", "content_base64": _b64(b"a,b\n1,2\n"),
                  "mime_type": "text/csv", "category": "sales"},
            timeout=30,
        )
        assert r.status_code == 401


# --------------------------- Excel & PDF parse ---------------------------
class TestParseOtherFormats:
    def test_parse_excel_xlsx(self, auth):
        try:
            from openpyxl import Workbook
        except Exception:
            pytest.skip("openpyxl not installed")
        wb = Workbook()
        ws = wb.active
        ws.append(["date", "total", "orders"])
        ws.append(["2025-01-08", 5000, 12])
        ws.append(["2025-01-09", 7500, 20])
        buf = io.BytesIO()
        wb.save(buf)
        b = buf.getvalue()
        r = requests.post(
            f"{BASE_URL}/api/integrations/parse",
            json={
                "filename": "TEST_sales.xlsx",
                "content_base64": _b64(b),
                "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "category": "sales",
            },
            headers=auth["headers"], timeout=120,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["kind"] == "excel"
        assert d["total_rows"] == 2
        assert "date" in d["headers"] and "total" in d["headers"]

    def test_parse_pdf_tabular(self, auth):
        try:
            from pypdf import PdfWriter  # noqa
            from reportlab.pdfgen import canvas  # pdf generator
            from reportlab.lib.pagesizes import letter
        except Exception:
            pytest.skip("reportlab not installed")
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=letter)
        y = 750
        for line in ["date,total,orders", "2025-01-10,4500,11", "2025-01-11,6100,18"]:
            c.drawString(72, y, line)
            y -= 18
        c.save()
        pdf_bytes = buf.getvalue()
        r = requests.post(
            f"{BASE_URL}/api/integrations/parse",
            json={"filename": "TEST.pdf", "content_base64": _b64(pdf_bytes),
                  "mime_type": "application/pdf", "category": "sales"},
            headers=auth["headers"], timeout=120,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["kind"] == "pdf"
        assert d["total_rows"] >= 1


# --------------------------- Import flows ---------------------------
class TestImportSales:
    def test_import_sales_increases_dashboard(self, auth):
        # get baseline dashboard revenue_30d
        base = requests.get(f"{BASE_URL}/api/dashboard/summary", headers=auth["headers"], timeout=60).json()
        base_rev = base["kpis"]["revenue_30d"]

        parsed = pytest.sales_parse  # from earlier test
        rows = [
            {"date": D1, "total": "12500", "orders": "42"},
            {"date": D2, "total": "18200", "orders": "55"},
            {"date": D3, "total": "9800", "orders": "31"},
        ]
        r = requests.post(
            f"{BASE_URL}/api/integrations/import",
            json={"upload_id": parsed["upload_id"], "category": "sales",
                  "mapping": parsed["ai_mapping"], "rows": rows},
            headers=auth["headers"], timeout=60,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["inserted"] == 3
        assert d["failed"] == 0
        # Verify dashboard reflects larger totals (within 30-day window)
        after = requests.get(f"{BASE_URL}/api/dashboard/summary", headers=auth["headers"], timeout=60).json()
        assert after["kpis"]["revenue_30d"] > base_rev


EXP_CSV = "date,category,amount,note\n2025-01-02,Gas,4200,TEST_import\n2025-01-03,Rent,85000,TEST_rent\n"


class TestImportExpenses:
    def test_import_expenses_appears_in_list(self, auth):
        parsed = requests.post(
            f"{BASE_URL}/api/integrations/parse",
            json={"filename": "TEST_exp.csv", "content_base64": _b64(EXP_CSV.encode()),
                  "mime_type": "text/csv", "category": "expenses"},
            headers=auth["headers"], timeout=120,
        ).json()
        rows = [{"date": D2, "category": "Gas", "amount": "4200", "note": "TEST_import"},
                {"date": D3, "category": "Rent", "amount": "85000", "note": "TEST_rent"}]
        r = requests.post(
            f"{BASE_URL}/api/integrations/import",
            json={"upload_id": parsed["upload_id"], "category": "expenses",
                  "mapping": parsed["ai_mapping"], "rows": rows},
            headers=auth["headers"], timeout=60,
        )
        assert r.status_code == 200
        assert r.json()["inserted"] == 2
        ex = requests.get(f"{BASE_URL}/api/expenses?days=365", headers=auth["headers"], timeout=60).json()
        notes = [it["note"] for it in ex["items"]]
        assert any("TEST_import" in n for n in notes)


INV_CSV = "name,unit,stock,min_stock,cost_per_unit\nTEST_Butter,kg,4.5,2,410\nTEST_Sauce,L,7.2,3,180\n"


class TestImportInventory:
    def test_import_inventory(self, auth):
        parsed = requests.post(
            f"{BASE_URL}/api/integrations/parse",
            json={"filename": "TEST_inv.csv", "content_base64": _b64(INV_CSV.encode()),
                  "mime_type": "text/csv", "category": "inventory"},
            headers=auth["headers"], timeout=120,
        ).json()
        rows = [{"name": "TEST_Butter", "unit": "kg", "stock": "4.5", "min_stock": "2", "cost_per_unit": "410"},
                {"name": "TEST_Sauce", "unit": "L", "stock": "7.2", "min_stock": "3", "cost_per_unit": "180"}]
        r = requests.post(
            f"{BASE_URL}/api/integrations/import",
            json={"upload_id": parsed["upload_id"], "category": "inventory",
                  "mapping": parsed["ai_mapping"], "rows": rows},
            headers=auth["headers"], timeout=60,
        )
        assert r.status_code == 200
        assert r.json()["inserted"] == 2
        inv = requests.get(f"{BASE_URL}/api/inventory", headers=auth["headers"], timeout=60).json()
        names = [i["name"] for i in inv]
        assert "TEST_Butter" in names and "TEST_Sauce" in names


class TestImportAttendance:
    def test_import_attendance_case_insensitive(self, auth):
        # Pick a real seeded employee name and vary its casing
        emps = requests.get(f"{BASE_URL}/api/employees", headers=auth["headers"], timeout=60).json()["employees"]
        assert len(emps) > 0
        real_name = emps[0]["name"]
        csv = (
            "employee_name,date,status\n"
            f"{real_name.lower()},2025-01-04,present\n"
            f"{real_name.upper()},2025-01-05,leave\n"
            "Nonexistent Ghost,2025-01-05,present\n"
        )
        parsed = requests.post(
            f"{BASE_URL}/api/integrations/parse",
            json={"filename": "TEST_att.csv", "content_base64": _b64(csv.encode()),
                  "mime_type": "text/csv", "category": "attendance"},
            headers=auth["headers"], timeout=120,
        ).json()
        rows = [
            {"employee_name": real_name.lower(), "date": "2025-01-04", "status": "present"},
            {"employee_name": real_name.upper(), "date": "2025-01-05", "status": "leave"},
            {"employee_name": "Nonexistent Ghost", "date": "2025-01-05", "status": "present"},
        ]
        r = requests.post(
            f"{BASE_URL}/api/integrations/import",
            json={"upload_id": parsed["upload_id"], "category": "attendance",
                  "mapping": parsed["ai_mapping"], "rows": rows},
            headers=auth["headers"], timeout=60,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["inserted"] == 2  # two matched rows (case-insensitive)
        assert d["failed"] == 1    # ghost row


# --------------------------- history ---------------------------
class TestHistory:
    def test_history_returns_sorted_items(self, auth):
        r = requests.get(f"{BASE_URL}/api/integrations/history", headers=auth["headers"], timeout=30)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 4  # sales, expenses, inventory, attendance uploads created above
        first = items[0]
        for field in ("upload_id", "filename", "category", "kind", "total_rows", "status", "created_at"):
            assert field in first, f"missing {field} in history row"
        # sorted desc by created_at
        dates = [it["created_at"] for it in items]
        assert dates == sorted(dates, reverse=True)

    def test_history_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/integrations/history", timeout=30)
        assert r.status_code == 401
