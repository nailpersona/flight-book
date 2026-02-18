# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fly-Book is an aviation logbook app for Ukrainian military pilots, migrating from Google Sheets to Supabase. The system tracks flight records, weather condition breaks (МУ), training breaks (ЛП), commissioning dates, and provides an AI chat for regulatory documents.

**Supabase Project ID:** `klqxadvtvxvizgdjmegx`

## Development Commands

### Mobile App (Expo/React Native) - Root Directory
```bash
npx expo start           # Start Expo dev server
npx expo start --android # Android emulator
npx expo start --ios     # iOS simulator
npx expo start --web     # Web version
```

### Web App (Next.js) - `web/` Directory
```bash
cd web
npm run dev              # Development server (port 3000)
npm run build            # Production build
npm run start            # Start production server
```

### Supabase Edge Functions
```bash
npx supabase functions deploy ask --project-ref klqxadvtvxvizgdjmegx
```

## Architecture

```
┌─────────────────────────┐     ┌─────────────────────────┐
│   Mobile App (Expo)     │     │   Web App (Next.js)     │
│   Root directory        │     │   web/ directory        │
│                         │     │                         │
│   Primary screens:      │     │   Admin dashboard:      │
│   - Flight entry        │     │   - All pilots overview │
│   - Personal breaks     │     │   - AI chat             │
│   - AI chat             │     │   - Summary reports     │
│   - Profile             │     │   - Admin panels        │
└────────────┬────────────┘     └────────────┬────────────┘
             │                               │
             └───────────┬───────────────────┘
                         │
                 ┌───────▼────────┐
                 │    Supabase    │
                 │  - Auth + RLS  │
                 │  - PostgreSQL  │
                 │  - pgvector    │
                 │  - Edge Funcs  │
                 └────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `App.js` | Mobile app entry point with navigation |
| `Main.js` | Flight entry form (primary screen) |
| `supabaseData.js` | Core data fetching and break calculations |
| `theme.js` | Centralized styling (colors, fonts) |
| `web/src/lib/supabase.js` | Supabase client for web |
| `web/src/lib/auth.js` | Web auth context (8-hour sessions) |
| `supabase/functions/ask/index.ts` | AI chat edge function (RAG) |

### Session Management
- Mobile: 7-day sessions (AsyncStorage)
- Web: 8-hour sessions (localStorage)

## Critical Business Rules

### Weather Conditions (МУ) Break Periods (days)
| МУ | 1st Class | 2nd Class | 3rd Class |
|----|-----------|-----------|-----------|
| ДПМУ | 107 | 92 | 76 |
| ДСМУ | 92 | 77 | 61 |
| ДВМП | 77 | 61 | 46 |
| НПМУ | 92 | 77 | 61 |
| НСМУ | 77 | 61 | 46 |
| НВМП | 61 | 46 | 30 |

### МУ Hierarchy (complex counts for simpler)
```
НВМП → НСМУ → НПМУ
  ↓       ↓       ↓
ДВМП → ДСМУ → ДПМУ
```
Flight in НВМП updates ALL weather conditions.

### Status Colors
- **2 (green)**: valid, >15 days remaining
- **1 (yellow)**: <15 days remaining
- **0 (red)**: expired

### Special Coefficients
- Test pilots (1st class): 1.5x break period
- Instructor flights: +50% break extension (max 1.5x)

### Flight Entry Rules
- **1 запис = 1 політ** (flights_count: 1 automatically when adding)
- Only **training** flights (NOT control) update break periods
- `exercises.lp_types text[]` — direct mapping of exercise → LP type codes
- `exercises.is_control boolean` — true for control/check flights

## Design Rules

- **All fonts must be `fontWeight: '400'`** (normal weight) — no bold text anywhere
- Font family: `NewsCycle-Regular` (mobile) / `News Cycle` (web)
- Color palette defined in `theme.js`

## Database Tables (Supabase)

| Table | Purpose |
|-------|---------|
| `users` | Pilot profiles with class/coefficients |
| `flights` | Flight records |
| `flight_exercises` | Flight ↔ exercises junction |
| `exercises` | KBP exercises with `lp_types[]`, `is_control` |
| `break_periods_mu` | MU break periods by class |
| `break_periods_lp` | LP break periods by class |
| `mu_break_dates` | Last MU flight dates per pilot/aircraft |
| `lp_break_dates` | Last LP flight dates per pilot |
| `ai_knowledge_base` | Structured rules from KBPs |
| `guide_documents` / `guide_sections` | Document browser content |

## Regulatory Documents

Located in `docs/`:
- `КБП ВА 2022.pdf` — Fighter aviation combat training (has МУ break values)
- `КЛПВ-24 еталон.docx` — Test pilot classification 2024
- `ПВП ДАУ наказ №2 від 05.01.2015.docx` — Flight operation rules

Parsed text versions available as `.txt` files for AI processing.

## AI/RAG System

Edge Function `ask`:
- Embedding: `text-embedding-3-small`
- Chat: `gpt-4.1-mini`
- Hybrid search: pgvector + keyword matching (threshold 0.22-0.25)

Documents indexed: КБП ВА, КБП БА/РА, КБПВ-18, КЛПВ-24, ПЛВР, ПВП ДАУ

## Ralph - Autonomous Task Executor

Ralph автоматично виконує задачі з PRD.md (checkbox format).

### Використання
```powershell
.\ralph.ps1                           # Стандартний режим (PRD.md)
.\ralph.ps1 -PrdFile "FEATURE.md"     # Вказати інший файл
.\ralph.ps1 -PauseAfterEach           # Пауза після кожної задачі
.\ralph.ps1 -MaxIterations 20         # Більше ітерацій
```

### Watchdog (авто-перезапуск)
```powershell
.\ralph-watchdog.ps1                  # Моніторинг кожні 10 хв
.\ralph-watchdog.ps1 -CheckIntervalMinutes 5  # Кожні 5 хв
```

### Перевірка статусу
```powershell
.\check-ralph.ps1                     # Швидка діагностика
```

### Зупинка
```powershell
echo '' > .ralph-stop                 # Graceful stop
```

### PRD.md формат
```markdown
# Feature Name

## Tasks
- [ ] First task
- [ ] Second task
- [x] Completed task
```

### progress.txt
Ralph записує learnings після кожної ітерації для наступних запусків.
