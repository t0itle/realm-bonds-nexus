
ALTER TABLE public.outposts ADD COLUMN garrison_troops jsonb NOT NULL DEFAULT '{"militia":0,"archer":0,"knight":0,"cavalry":0,"siege":0,"scout":0}'::jsonb;
