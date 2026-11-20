# Constelación ×

App web para aprender las tablas de multiplicar (2 al 10) con repetición espaciada.

- `index.html`: la app del estudiante. Funciona sin internet y sincroniza cuando hay conexión.
- `tutor.html`: el panel del tutor, en vivo.
- `supabase/schema.sql`: la base de datos. Se pega una vez en Supabase → SQL Editor → Run.
- `config.js`: URL del proyecto de Supabase y llave pública (anon / publishable).

## Publicar
1. Correr `supabase/schema.sql` en el SQL Editor de Supabase.
2. Llenar `config.js`.
3. Subir esta carpeta a un repositorio y activar GitHub Pages (Settings → Pages → rama `main`, carpeta raíz).
4. Al cambiar archivos, subir `VERSION` en `sw.js` para que los dispositivos tomen la versión nueva.
