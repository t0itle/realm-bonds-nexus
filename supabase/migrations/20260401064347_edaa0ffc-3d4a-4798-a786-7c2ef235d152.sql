UPDATE villages
SET 
  map_x = 420000 + (random() * 160000 - 80000),
  map_y = 470000 + (random() * 160000 - 80000)
WHERE map_x = 0 AND map_y = 0;