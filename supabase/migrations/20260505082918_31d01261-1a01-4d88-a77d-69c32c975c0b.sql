
-- Reposition realms and towns into a true crescent shape opening east, around Khar-Anum (500,500)
WITH new_caps(name, nx, ny) AS (
  VALUES
    ('Drakkanmar', 670, 206),
    ('Halqaran',   476, 161),
    ('Olethros',   286, 236),
    ('Vehruun',    175, 401),
    ('Ysmir Vale', 175, 599),
    ('Ainwyrd',    286, 764),
    ('Karzûl',     476, 839),
    ('Sephar-Tul', 670, 794)
),
old_caps AS (
  SELECT r.id AS realm_id, r.name, r.capital_x AS ox, r.capital_y AS oy, nc.nx, nc.ny
  FROM realms r JOIN new_caps nc ON nc.name = r.name
)
UPDATE realm_towns t
SET x = oc.nx + (t.x - oc.ox),
    y = oc.ny + (t.y - oc.oy)
FROM old_caps oc
WHERE t.realm_id = oc.realm_id;

UPDATE realms r
SET capital_x = nc.nx, capital_y = nc.ny
FROM (VALUES
  ('Drakkanmar', 670, 206),
  ('Halqaran',   476, 161),
  ('Olethros',   286, 236),
  ('Vehruun',    175, 401),
  ('Ysmir Vale', 175, 599),
  ('Ainwyrd',    286, 764),
  ('Karzûl',     476, 839),
  ('Sephar-Tul', 670, 794)
) AS nc(name, nx, ny)
WHERE r.name = nc.name;
