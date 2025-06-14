-- Script de migración para modificar la tabla tickets
-- Elimina la restricción de clave foránea en el campo created_by

-- Primero identificamos el nombre de la restricción
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'tickets'::regclass
    AND contype = 'f'
    AND array_position(conkey, (
        SELECT attnum
        FROM pg_attribute
        WHERE attrelid = 'tickets'::regclass
        AND attname = 'created_by'
    )) IS NOT NULL;

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE tickets DROP CONSTRAINT ' || constraint_name;
        RAISE NOTICE 'Restricción % eliminada', constraint_name;
    ELSE
        RAISE NOTICE 'No se encontró restricción para created_by';
    END IF;
END $$; 