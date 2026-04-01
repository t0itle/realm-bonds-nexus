
-- Remove all wall segments first (foreign key dependency)
DELETE FROM wall_segments;

-- Remove all outposts
DELETE FROM outposts;

-- Rescale village positions by 100x
UPDATE villages
SET map_x = map_x * 100,
    map_y = map_y * 100;
