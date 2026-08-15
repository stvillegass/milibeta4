-- Función para obtener los slots ocupados de manera segura sin exponer datos de clientes
-- Retorna las horas y fechas de las citas que están confirmadas o pendientes.

CREATE OR REPLACE FUNCTION get_occupied_slots()
RETURNS TABLE(date TEXT, time TEXT) AS $$
BEGIN
  RETURN QUERY 
  SELECT 
    to_char(start_time AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
    to_char(start_time AT TIME ZONE 'UTC', 'HH24:MI') AS time
  FROM public.bookings 
  WHERE status IN ('confirmed', 'pending');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permisos a usuarios públicos y autenticados para ejecutar esta función
GRANT EXECUTE ON FUNCTION get_occupied_slots() TO public;
GRANT EXECUTE ON FUNCTION get_occupied_slots() TO authenticated;
GRANT EXECUTE ON FUNCTION get_occupied_slots() TO anon;
