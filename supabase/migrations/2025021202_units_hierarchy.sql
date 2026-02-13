-- Підрозділи (бригада -> ескадрилья -> ланка)
CREATE TYPE unit_type AS ENUM ('brigade', 'squadron', 'linka');

CREATE TABLE IF NOT EXISTS units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type unit_type NOT NULL,
  parent_id uuid REFERENCES units(id) ON DELETE SET NULL,
  commander_id uuid REFERENCES users(id) ON DELETE SET NULL,
  order_num integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_units_parent ON units(parent_id);
CREATE INDEX idx_units_commander ON units(commander_id);
CREATE INDEX idx_units_type ON units(type);

-- Додаємо unit_id до таблиці users
ALTER TABLE users ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES units(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_unit ON users(unit_id);

-- RLS вимкнено, оскільки використовується кастомна автентифікація
-- Права доступу реалізовуються на рівні додатку

-- Функція для отримання всіх підрозділів доступних користувачу (свій + дочірні)
CREATE OR REPLACE FUNCTION fn_get_accessible_units(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (id uuid, name text, type unit_type, parent_id uuid, commander_id uuid, order_num integer, path text[], depth integer) AS $$
DECLARE
  v_user_unit_id uuid;
BEGIN
  -- Отримуємо підрозділ користувача
  SELECT unit_id INTO v_user_unit_id FROM users WHERE id = p_user_id;

  -- Якщо адмін або без підрозділу - повертаємо всі
  IF v_user_unit_id IS NULL OR EXISTS (SELECT 1 FROM users WHERE id = p_user_id AND role = 'admin') THEN
    RETURN QUERY
    SELECT
      u.id, u.name, u.type, u.parent_id, u.commander_id, u.order_num,
      ARRAY[u.name]::text[],
      0
    FROM units u
    ORDER BY u.type, u.order_num, u.name;
    RETURN;
  END IF;

  -- Рекурсивно отримуємо підрозділ + всі дочірні
  RETURN QUERY
  WITH RECURSIVE unit_tree AS (
    -- Корінь - підрозділ користувача
    SELECT
      u.id, u.name, u.type, u.parent_id, u.commander_id, u.order_num,
      ARRAY[u.name]::text[] as path,
      0 as depth
    FROM units u
    WHERE u.id = v_user_unit_id

    UNION ALL

    -- Дочірні підрозділи
    SELECT
      u.id, u.name, u.type, u.parent_id, u.commander_id, u.order_num,
      ut.path || u.name,
      ut.depth + 1
    FROM units u
    INNER JOIN unit_tree ut ON u.parent_id = ut.id
  )
  SELECT * FROM unit_tree
  ORDER BY path, type, order_num, name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функція для отримання всіх користувачів доступних командиру (свой підрозділ + дочірні)
CREATE OR REPLACE FUNCTION fn_get_accessible_users(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (id uuid, name text, email text, rank text, "position" text, unit_id uuid, unit_name text, unit_type unit_type) AS $$
DECLARE
  v_user_unit_id uuid;
  v_is_admin boolean;
BEGIN
  SELECT unit_id, (role = 'admin') INTO v_user_unit_id, v_is_admin
  FROM users WHERE id = p_user_id;

  -- Адміни бачать всіх
  IF v_is_admin THEN
    RETURN QUERY
    SELECT
      u.id, u.name, u.email, u.rank, u."position",
      u.unit_id, unt.name, unt.type
    FROM users u
    LEFT JOIN units unt ON u.unit_id = unt.id
    ORDER BY u.name;
    RETURN;
  END IF;

  -- Звичайний користувач бачить тільки свій підрозділ + дочірні
  RETURN QUERY
  WITH RECURSIVE unit_tree AS (
    SELECT id FROM units WHERE id = v_user_unit_id
    UNION ALL
    SELECT u.id FROM units u
    INNER JOIN unit_tree ut ON u.parent_id = ut.id
  )
  SELECT
    u.id, u.name, u.email, u.rank, u."position",
    u.unit_id, unt.name, unt.type
  FROM users u
  LEFT JOIN units unt ON u.unit_id = unt.id
  WHERE u.unit_id IN (SELECT id FROM unit_tree)
  ORDER BY unt.type, unt.order_num, u.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
