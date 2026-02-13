-- Спочатку створимо посади (якщо їх ще немає)
INSERT INTO positions (name, parent_id, order_num) VALUES
  ('Начальник ЛВК', NULL, 1),
  ('Заступник начальника ЛВК', NULL, 2),
  ('Заступник начальника ЛВК з ЛП', NULL, 3),
  ('Начальник БзП ЛВК', NULL, 4),
  ('Командир ЗАЗ', NULL, 5),
  ('Старший льотчик ЗАЗ', NULL, 6)
ON CONFLICT (name) DO NOTHING;

-- Тепер оновимо користувачів з правильними назвами посад
UPDATE users SET position = 'Начальник ЛВК' WHERE position = 'Начальник ЛВК';  -- вже правильно
UPDATE users SET position = 'Заступник начальника ЛВК' WHERE position = 'ЗНЛВК';
UPDATE users SET position = 'Заступник начальника ЛВК з ЛП' WHERE position = 'ЗНЛВК з ЛП';
UPDATE users SET position = 'Начальник БзП ЛВК' WHERE position = 'Нач. СБП';
UPDATE users SET position = 'Командир ЗАЗ' WHERE position = 'Ком. ЗАЗ';
UPDATE users SET position = 'Старший льотчик ЗАЗ' WHERE position = 'Ст. л-к';

-- Перевіримо результат
SELECT id, name, position FROM users WHERE position IS NOT NULL;
