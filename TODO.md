# TODO — Fly-Book

## Supabase проект
- **Project ID:** `klqxadvtvxvizgdjmegx`
- **URL:** `https://klqxadvtvxvizgdjmegx.supabase.co`

---

## 1. Додати flights_count для вправ (база даних)

Кожна вправа має поле `flights_count` (text) — кількість польотів. Наприклад: `'6'`, `'РК'` (рішення командира).

### Стан зараз:
| Документ | Задача | Всього | Є flights_count | Немає |
|----------|--------|--------|-----------------|-------|
| КБП ВА | Задача 1 | 103 | 103 | 0 |
| КБП ВА | Задача 2 | 62 | 62 | 0 |
| **КБП ВА** | **Інструктори** | **22** | **0** | **22** |
| **КБП ВА** | **Удосконалення** | **20** | **0** | **20** |
| **КЛПВ** | **Програма 1** | **60** | **0** | **60** |
| **КЛПВ** | **Програма 2 Задача 1** | **57** | **0** | **57** |
| **КЛПВ** | **Програма 2 Задача 2** | **43** | **0** | **43** |
| **КЛПВ** | **Програма 2 Задача 4** | **44** | **0** | **44** |
| **КЛПВ** | **Програма 2 Задача 5** | **13** | **0** | **13** |

### Що робити:

#### 1.1 КБП ВА — Інструктори (22 вправи)
Джерело: `docs/KBP-VA-2022.txt`, розділ "Інструктори" (≈ рядки 13400+).
Готовий SQL (витягнутий попереднім чатом, перевірений по документу):
```sql
UPDATE exercises SET flights_count = CASE number
  WHEN '201' THEN '1'
  WHEN '202' THEN '4'
  WHEN '203' THEN '4'
  WHEN '204' THEN '3'
  WHEN '205' THEN '2'
  WHEN '206' THEN '2'
  WHEN '207' THEN '2'
  WHEN '208' THEN '1'
  WHEN '209' THEN '2'
  WHEN '209а' THEN '2'
  WHEN '210' THEN '1'
  WHEN '211' THEN '1'
  WHEN '212' THEN '1'
  WHEN '213' THEN '1'
  WHEN '214' THEN '4'
  WHEN '215' THEN '4'
  WHEN '216' THEN '1'
  WHEN '217' THEN '2'
  WHEN '218' THEN '2'
  WHEN '222' THEN 'РК'
  WHEN '223' THEN 'РК'
  WHEN '224' THEN '1'
END
WHERE document = 'КБП ВА' AND task = 'Інструктори'
  AND number IN ('201','202','203','204','205','206','207','208','209','209а','210','211','212','213','214','215','216','217','218','222','223','224');
```

#### 1.2 КБП ВА — Удосконалення (20 вправ)
Джерело: `docs/KBP-VA-2022.txt`, розділ "Удосконалення" (≈ рядки 15300+).
Готовий SQL:
```sql
UPDATE exercises SET flights_count = CASE number
  WHEN '10у' THEN '1'
  WHEN '11у' THEN '1'
  WHEN '12у' THEN '1'
  WHEN '13у' THEN 'РК'
  WHEN '17у' THEN '2'
  WHEN '18у' THEN 'РК'
  WHEN '19у' THEN '3'
  WHEN '20у' THEN 'РК'
  WHEN '21у' THEN '2'
  WHEN '22у' THEN 'РК'
  WHEN '36ку' THEN 'РК'
  WHEN '36у' THEN 'РК'
  WHEN '40у' THEN '2'
  WHEN '53у' THEN 'РК'
  WHEN '54у' THEN '2'
  WHEN '56у' THEN '2'
  WHEN '58у' THEN '2'
  WHEN '67у' THEN 'РК'
  WHEN '101у' THEN 'РК'
  WHEN '102у' THEN 'РК'
END
WHERE document = 'КБП ВА' AND task = 'Удосконалення'
  AND number IN ('10у','11у','12у','13у','17у','18у','19у','20у','21у','22у','36ку','36у','40у','53у','54у','56у','58у','67у','101у','102у');
```

#### 1.3 КЛПВ — всі програми (217 вправ)
Джерело: `docs/KLPV-24.md`.
Потрібно витягти `flights_count` з документа для кожної вправи.
Застосувати через `apply_migration` для кожної програми окремо.
Формат в документі: "(X пол.)" або "РК".

---

## 2. Оновити відображення вправ у формі

**Файл:** `Main.js`

### Зараз:
Рядок ~127: `{ex.number} — {ex.name}` (chips)
Рядок ~168: `{item.number} — {item.name}` (список)

### Потрібно:
Формат: `18(6) Політ на складний пілотаж`
- `number` — номер вправи
- `(flights_count)` — кількість польотів в дужках
- Якщо `flights_count` = null або відсутній — не показувати дужки
- Якщо `flights_count` = 'РК' — показувати `18(РК) Назва`

### Також потрібно:
1. Додати `flights_count` до запиту Supabase (рядок ~276):
   ```js
   .select('id, number, name, document, task, category, flights_count')
   ```
2. Оновити відображення в чіпсах (рядок ~127):
   ```js
   {ex.number}{ex.flights_count ? `(${ex.flights_count})` : ''} {ex.name}
   ```
3. Оновити відображення в списку (рядок ~168):
   ```js
   {item.number}{item.flights_count ? `(${item.flights_count})` : ''} {item.name}
   ```

---

## 3. Наступні етапи (за PROJECT.md)

### 3.1 Таблиці для решти функціоналу
Ще НЕ створені таблиці (за планом з PROJECT.md):
- `users` — профілі пілотів (id, email, name, rank, position, military_class, test_class, coefficient)
- `user_aircraft` — зв'язок пілот ↔ тип ПС
- `break_periods_mu` — конфігурація перерв за МУ по класах
- `break_periods_lp` — конфігурація перерв за видами ЛП
- `commission_types` — типи комісування з термінами
- `commission_dates` — дати комісування пілотів
- `annual_checks` — річні перевірки
- `documents` / `document_chunks` — для RAG (pgvector)

### 3.2 Auth
Замінити поточну Google Apps Script автентифікацію на Supabase Auth.
Поточні файли: `Login.js`, `api.js`.

### 3.3 RLS-політики
Жодна таблиця поки не має RLS. Потрібно:
- Увімкнути RLS на всіх таблицях
- Створити політики (пілот бачить тільки свої польоти, адмін — всі)

### 3.4 Інші екрани мобільного додатку
- Перерви за МУ (`BreaksMU.js`) — оновити під Supabase
- Перерви за ЛП (`BreaksLP.js`) — оновити під Supabase
- Комісування (`CommissionTable.js`) — оновити
- Річні перевірки — новий екран
- Налаштування — новий екран
- ШІ-чат — новий екран

### 3.5 Web Dashboard (Next.js)
Ще не починали. Планується:
- Дашборд стану БГ всіх пілотів
- Графіки/аналітика
- ШІ-чат
- Адмін-панель
- Звіти

---

## Існуючі таблиці Supabase

| Таблиця | Рядків | Опис |
|---------|--------|------|
| aircraft_types | 3 | МіГ-29, Су-27, Л-39 |
| exercises | 424 | Вправи КБП ВА + КЛПВ |
| flights | 0 | Записи польотів |
| flight_exercises | 0 | Зв'язок політ ↔ вправи |
| fuel_records | 0 | Заправка (аеродром + кількість) |

## Міграції (16 шт.)
1. create_core_schema
2. seed_aircraft_types
3. seed_exercises_task1_tp
4. seed_exercises_task1_bz
5. seed_exercises_task1_lanky_ltp
6. seed_exercises_task2
7. seed_exercises_instructors_improvement
8. seed_klpv_program1
9. seed_klpv_program2_task1
10. seed_klpv_program2_task2
11. seed_klpv_program2_tasks345
12. add_flights_count_to_exercises
13. update_kbp_flights_count_task1_tp (вправи 1-36)
14. update_flights_count_bz_37_71 (вправи 37-71)
15. update_flights_count_lanky_ltp (вправи 72-100)
16. update_flights_count_night (Задача 2, всі)

## Ключові файли проекту
- `Main.js` — форма вводу польоту (переписана)
- `supabase.js` — клієнт Supabase
- `PROJECT.md` — повний опис проекту та бізнес-правила
- `docs/KBP-VA-2022.txt` — КБП ВА (джерело вправ + flights_count)
- `docs/KLPV-24.md` — КЛПВ (джерело вправ КЛПВ)

## Стилі Main.js
- Всюди `fontWeight: '400'`
- Всюди `fontFamily: 'NewsCycle-Regular'`
