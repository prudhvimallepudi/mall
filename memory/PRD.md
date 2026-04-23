# Restaurant Management Dashboard — PRD

## Vision
Mobile-first SaaS dashboard for restaurant & hotel owners with consolidated sales, inventory, expenses, menu, staff, and data imports — plus a **global AI assistant** that answers context-aware questions on any screen.

## Current Navigation (iteration 5)
**Bottom tabs (6)**: Dashboard · Inventory · Expenses · Staff · Menu · Profile

**Global AI FAB** (top-right, pink→purple→blue gradient): opens a context-aware chat sheet. The AI knows which tab is active and answers from that tab's data using Claude Sonnet 4.5.

**Hidden routes**: `/insights` and `/integrations` still exist but are reached programmatically (from Dashboard Quick Actions) — not in tab bar.

## Shipped Features
- **Auth**: Emergent Google OAuth (web) + demo email login (native)
- **Dashboard**: KPIs (today's sales / orders / avg ticket / 30d profit), **Quick Actions** (Import CSV / Upload Excel / Upload PDF / Sync Data), 7-day sales chart, payment mode bars, top-selling items, low-stock alert card
- **Inventory**: Low-stock indicators, search, inline stock adjust, Add FAB
- **Expenses**: Category breakdown, recent entries, Add FAB, CSV paste import
- **Staff**: 24 seeded employees, attendance KPI, tap-to-cycle attendance, Add FAB
- **Menu Analytics**: Profit / cost / margin / revenue per item
- **Profile**: 12 preset food-themed avatars, business details (name / GST / logo)
- **AI Assistant**: Global floating sparkle button. Per-tab context. Suggested questions. Real-time chat powered by Claude Sonnet 4.5.
- **Integrations (via Quick Actions)**: CSV / Excel / PDF / Image upload with AI column-mapping (Claude) + OCR (GPT-4o Vision) + preview + one-click import into sales/expenses/inventory/attendance + upload history + live POS APIs teaser (Petpooja/Zomato/Swiggy coming soon)
- **Multi-branch**: 3 seeded branches + "All" view everywhere

## Demo Seeding (per new user)
3 branches × 10 menu items × 10 inventory items × 8 employees · 60 days expenses · 90 days sales · 30 days attendance.

## Tech Stack
- Frontend: Expo SDK 54, expo-router, expo-document-picker, expo-linear-gradient, react-native-chart-kit
- Backend: FastAPI + Motor (MongoDB), emergentintegrations — Claude Sonnet 4.5 (insights / mapping / chat) + GPT-4o Vision (OCR)
- Tests: **63/63 backend pytest tests passing**

## Key API Endpoints
- Auth, Branches, Dashboard, Inventory, Expenses, Menu, Staff/Attendance, Integrations (parse/import/history), Profile
- **AI**: `POST /api/ai/ask` (context + question), `GET /api/ai/suggestions?context=…`, `GET /api/ai/insights`

## Deferred / Next Iterations
- Live POS connectors (Petpooja, Zomato, Swiggy, POSist, Restroworks) — needs vendor keys
- Push notifications — needs EAS dev build + FCM
- Light/dark theme toggle, Branch CRUD UI
- Android APK packaging & Play Store launch
- First-class `profile` prompt in AI backend (currently falls back to dashboard context)
- Server-side persist of parsed rows for very large file imports
