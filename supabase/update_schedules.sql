-- Actualización de la tabla schedules para soportar turnos individuales (slots)
-- en lugar de un bloque de tiempo continuo.

ALTER TABLE public.schedules DROP COLUMN IF EXISTS open_time;
ALTER TABLE public.schedules DROP COLUMN IF EXISTS close_time;

ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS slots TEXT[] NOT NULL DEFAULT '{}';
