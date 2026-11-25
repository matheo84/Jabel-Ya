# Jabel Ya´ · Pedidos de agua pura

<img src="assets/logo.jpg" alt="Purificadora Jabel Ya´" width="200">

Aplicación para el celular de la purificadora **Jabel Ya´**, agua pura, vida sana (WhatsApp **4237 2018**).

## Dos apps, una sola hoja de Google

El proyecto trae **dos apps** que usan el mismo Google Sheet. Cada una se instala por separado en el celular, con su propio ícono:

| App | Dirección (en GitHub Pages) | Para quién | Qué tiene |
|---|---|---|---|
| 🧾 **Pedidos y reparto** | `https://TU_USUARIO.github.io/jabel-ya/` | Quien toma pedidos y el repartidor | **Pedidos, Nuevo, Mapa y Clientes**. El mapa usa el GPS y muestra primero la entrega más cercana con su ruta. |
| 📊 **Dueño** (ícono con “D”) | `…/jabel-ya/dueno/` | Solo el administrador | **Resumen** con gráficas, **Cobros** pendientes, **Usuarios** y **Ajustes**. |

En la app de pedidos no hay pestaña de ajustes. Solo se abre una pantalla pequeña con la cuenta (sincronizar, cerrar sesión, instalar) al **tocar el logo** de arriba.

### App de pedidos y reparto
- **Pedidos**: lista de pendientes, entregados, por cobrar y todos. Con el GPS activo, los pendientes se ordenan del más cercano al más lejano (“📍 a 350 m de ti”).
- **Nuevo**: registra cliente, teléfono, dirección, referencia, producto, cantidad, precio, notas y repartidor. Arriba está **Repetir pedido**: los clientes frecuentes (⭐ o con 2 pedidos o más) se repiten con un toque.
- **Mapa**: al abrirlo **se activa el GPS del celular** (punto azul). Abajo aparece la **siguiente entrega**, la casa pendiente más cercana, con distancia, garrafones, cuánto cobrar y los botones **🧭 Cómo llegar** (ruta en Google Maps), **✓ Entregado**, **Llamar** y **Avisar**. **Ruta completa** abre Google Maps con todas las paradas en orden (hasta 10).
- **Clientes**: fotos y punto GPS de cada casa, ⭐ frecuente y **↻ Repetir pedido**.
- **Entregar y cobrar**: al marcar entregado pregunta **💵 Pagó** o **📒 Queda fiado**.
- **Avisos con stickers** por WhatsApp.
- Si entra un **repartidor**, solo ve los pedidos que le asignaste, y no aparece la pestaña **Nuevo**.

### App del dueño
- **Resumen** por **día, semana o mes** (con flechas para ver periodos anteriores): vendido, garrafones, cobrado, fiado, y cuánto subió o bajó contra el periodo anterior.
- **Gráficas**: garrafones vendidos por hora o por día (marca el mejor), **comparación con el periodo anterior** y **¿qué día de la semana se vende más agua?** (promedio de las últimas 8 semanas).
- Ventas por producto y por repartidor.
- **Cobros**: quién debe, cuántos garrafones fiados y desde cuándo, con **Cobrar todo** y **Recordar por WhatsApp**.
- **Usuarios** y **Ajustes** (precio del garrafón, copia de seguridad).
- Si un repartidor intenta entrar aquí, la app no le muestra nada.

Las dos apps comparten la sesión en el mismo celular: si entras en una, ya estás dentro en la otra.

Cada celular guarda una copia de los datos, así que la app sigue funcionando sin señal. Cuando vuelve el internet, los cambios se suben solos (cada minuto y unos segundos después de cada cambio). Arriba se ve el estado: **✓ Sheets 10:35** (todo subido), **⟳ 2 por subir** o **Sin señal**. Al tocarlo se sincroniza en ese momento.

---

## Archivos del proyecto

```
index.html             App de pedidos y reparto (página principal)
dueno/                 App del dueño (index.html + manifest)
styles.css             Colores y diseño
app.js                 Lógica de las dos apps: pedidos, cobros, reportes, mapa, GPS, usuarios
db.js                  Base de datos del celular (IndexedDB)
sw.js                  Permite abrir la app sin internet
manifest.webmanifest   Nombre e ícono para instalarla en el celular
icons/                 Íconos de la app (logo)
assets/                Logo y stickers de Jabel Ya´
google-apps-script/    Código para Google Sheets (Codigo.gs)
vendor/leaflet/        Librería del mapa (Leaflet 1.9.4, licencia BSD-2)
```

## Probarla en la computadora

La cámara, el GPS y la instalación solo funcionan desde `https://` o desde `localhost`:

```bash
python3 -m http.server 8000     # o: npx serve .
```

Abre <http://localhost:8000> y toca **Usar solo en este celular, sin cuenta**. En **Pedidos** aparece **Cargar datos de ejemplo**.

---

## 1. Subirla a GitHub

### Opción A: desde la página de GitHub (sin instalar nada)

1. Entra a <https://github.com> e inicia sesión.
2. Arriba a la derecha: **+ → New repository**.
3. **Repository name**: `jabel-ya`. Déjalo **Public** (necesario para GitHub Pages gratis). Toca **Create repository**.
4. Toca el enlace **uploading an existing file**.
5. Arrastra **todo el contenido** de esta carpeta (los archivos y las carpetas `icons`, `assets`, `dueno`, `google-apps-script` y `vendor`, no la carpeta de afuera) y toca **Commit changes**.

### Opción B: con Git en la terminal

```bash
cd jabel-ya
git init
git add .
git commit -m "App Jabel Ya´"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/jabel-ya.git
git push -u origin main
```

### Publicarla gratis con GitHub Pages

1. En tu repositorio: **Settings → Pages**.
2. **Source**: **Deploy from a branch**. **Branch**: `main`, carpeta `/ (root)`. **Save**.
3. En 1 o 2 minutos aparece la dirección de tu app: `https://TU_USUARIO.github.io/jabel-ya/`

---

## 2. Conectar con Google Sheets

Se hace **una sola vez**, desde la computadora, con la cuenta de Google de la purificadora.

### Crear la hoja y pegar el código

1. Entra a <https://sheets.google.com>, crea una **hoja en blanco** y llámala **Jabel Ya - Pedidos**.
2. Menú **Extensiones → Apps Script**. Se abre un archivo `Código.gs`: **borra todo** lo que tiene.
3. Copia todo el contenido de [`google-apps-script/Codigo.gs`](google-apps-script/Codigo.gs) y pégalo ahí.
4. Arriba del código están los datos del **primer administrador**:
   ```js
   const ADMIN_USUARIO = 'juan';
   const ADMIN_NOMBRE = 'Juan';
   const ADMIN_PIN = '1234';
   ```
   **Cambia el PIN** por uno tuyo. Usa **6 números o más**, porque la dirección del script queda en el código público de GitHub. Ese es tu acceso de administrador.
5. Toca **Guardar** (💾).

### Dar permisos

1. En la lista de funciones de arriba elige **instalar** y toca **▶ Ejecutar**.
2. **Revisar permisos** → elige tu cuenta. Si sale “Google no verificó esta app”: **Configuración avanzada → Ir a Jabel Ya (no seguro)**. Es normal: el script es tuyo.
3. **Permitir**. Tu hoja ya tiene las pestañas **Clientes**, **Pedidos** y **Usuarios**, y en Drive aparece la carpeta **Jabel Ya - Fotos de casas**.

### Publicar el script

1. **Implementar → Nueva implementación**. En el engrane ⚙️ elige **Aplicación web**.
2. **Ejecutar como**: **Yo**. **Quién tiene acceso**: **Cualquier usuario**.
3. **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`).

> “Cualquier usuario” solo significa que la app puede llegar al script. Nadie puede leer ni cambiar datos sin un **usuario y PIN** válidos.

### Entrar como administrador

1. Abre la app del dueño (`https://TU_USUARIO.github.io/jabel-ya/dueno/`).
2. Escribe tu usuario (`juan`), tu PIN, y en **Dirección de Google Sheets** pega la URL del script.
3. Toca **Entrar**. Si ya tenías pedidos en ese celular, se suben a la hoja.

> La dirección del script de Jabel Ya´ ya viene escrita en `app.js` (`API_PREDETERMINADA`), así que en la pantalla de entrar solo hace falta usuario y PIN. Si algún día publicas el script con otra URL, cámbiala ahí.

---

## 3. Agregar al repartidor

1. En la app del dueño: **Usuarios → Agregar usuario**.
2. Escribe el usuario (por ejemplo `pedro`, sin espacios ni tildes), el nombre, el rol **Repartidor** y un **PIN**. Toca **Guardar usuario**.
3. Toca **Copiar enlace para el repartidor** y mándaselo por WhatsApp junto con su usuario y PIN. El enlace abre la app de pedidos y reparto; él solo escribe usuario y PIN y la instala.
4. Al registrar un pedido, elige en **Repartidor** a quién le toca. El repartidor solo ve los pedidos asignados a él. Los pedidos “Sin asignar” solo los ve el administrador.

Desde **Usuarios** (app del dueño) puedes **Editar** (cambiar nombre, rol o PIN), **desactivar** o **borrar** a un usuario. Cada quien puede cambiar su PIN tocando el **logo** de arriba → **Mi cuenta → Cambiar mi PIN**. Al **Cerrar sesión**, los datos se borran de ese celular (siguen en el Sheet).

---

## 4. Instalar las apps en el celular

Abre cada app en su dirección y instálala:

- **Android (Chrome)**: aparece el aviso **Instala Jabel Ya´ en tu celular → Instalar** (también en el menú ⋮ → **Instalar app**).
- **iPhone (Safari)**: botón **Compartir** (cuadro con flecha) → **Agregar a inicio**.

Sugerencia: en tu celular instala **Pedidos y reparto** y **Dueño**. En el del repartidor, solo **Pedidos y reparto**. Cada una queda con su ícono (la gota, y la gota con “D”). La primera vez que uses el GPS o la cámara, acepta los permisos.

---

## 5. Cómo se usa en el día

1. **App de pedidos → Nuevo**: toca un cliente frecuente en **Repetir pedido**, o llena el formulario y elige el repartidor.
2. **Repartidor (misma app)**: abre el **Mapa**, sigue la **siguiente entrega** con **🧭 Cómo llegar** y, al llegar, **✓ Entregado → Pagó / Queda fiado**. Si la casa no tiene GPS, la app ofrece guardarlo en ese momento.
3. **Avisar**: manda el sticker y el mensaje por WhatsApp.
4. **App del dueño**: revisa el **Resumen** y las gráficas, y cobra los fiados en **Cobros**.

---

## Qué hay en la hoja de Google

- **Pedidos**: cliente, producto, cantidad, precio, total, estado (`pendiente`/`entregado`), pagado (`si`/`no`), repartidor, notas y fechas de pedido, entrega y pago. Sirve para tus cuentas y filtros.
- **Clientes**: nombre, teléfono, zona, dirección, referencia, frecuente, GPS y enlaces a las fotos.
- **Usuarios**: usuario, nombre, rol y activo. El PIN se guarda **cifrado**, nadie lo puede leer (ni tú). Si alguien olvida su PIN, cámbialo en la app del dueño: **Usuarios → Editar**.
- Las columnas `id`, `clienteId`, `creado`, `entregadoEn`, `pagadoEn`, `actualizado` y `pin_cifrado` las usa la app: **no las cambies**.

Las fotos están en la carpeta **Jabel Ya - Fotos de casas** de tu Drive, compartidas con “cualquier persona con el enlace” para que la app las muestre.

### Si actualizas el código del script

Pega el `Codigo.gs` nuevo y ve a **Implementar → Gestionar implementaciones → ✏️ Editar → Versión: Nueva versión → Implementar**. La URL no cambia y las hojas se acomodan solas (no se pierden datos).

### Si olvidaste el PIN de administrador

Si hay otro administrador, que te cambie el PIN desde **Usuarios**. Si no: en la hoja, pestaña **Usuarios**, borra **todas las filas menos el encabezado**, cambia `ADMIN_PIN` en el script y publica una versión nueva. El script vuelve a crear tu usuario con ese PIN; después agrega otra vez a los repartidores.

### Problemas comunes

| Mensaje en la app | Solución |
|---|---|
| Usuario o PIN incorrecto | Revisa el usuario (en minúsculas) y el PIN. El administrador lo puede cambiar en Usuarios. |
| El script no respondió bien | En “Quién tiene acceso” no quedó **Cualquier usuario**, o la URL no termina en `/exec`. |
| Sin conexión | Revisa el internet. Los cambios se guardan y se suben cuando vuelva la señal. |
| Demasiados intentos con PIN equivocado | Se pusieron 5 PIN malos seguidos. Ese usuario queda bloqueado 15 minutos para que nadie pueda adivinar el PIN. |
| Al abrir la URL del script sale la página para iniciar sesión de Google | En **Quién tiene acceso** quedó “Solo yo” o “Cualquier usuario con cuenta de Google”. Cámbialo a **Cualquier usuario** (ver abajo). |

### Revisar que el script quedó público

Abre la URL del script (la que termina en `/exec`) en una ventana de incógnito. Debe mostrar solo este texto:
`{"ok":true,"app":"jabelya","mensaje":"La API de Jabel Ya´ está funcionando."}`
Si te pide iniciar sesión con Google: **Implementar → Gestionar implementaciones → ✏️ Editar → Quién tiene acceso: Cualquier usuario → Versión: Nueva versión → Implementar**.

---

## 6. Dominio propio (opcional), por ejemplo `jabelya.com`

Así tu app queda en `https://jabelya.com` en vez de `https://TU_USUARIO.github.io/jabel-ya/`.

1. **Compra el dominio** en un registrador como Namecheap, Cloudflare, GoDaddy o Porkbun (un `.com` cuesta alrededor de Q80 a Q120 al año). Un `.com.gt` se compra en <https://www.gt> (es más caro).
2. En GitHub, en tu repositorio: **Settings → Pages → Custom domain**, escribe `jabelya.com` (o `app.jabelya.com`) y toca **Save**. GitHub crea un archivo `CNAME` en el repositorio.
3. En la página donde compraste el dominio, entra a **DNS** y agrega:
   - **Si usas el dominio principal** (`jabelya.com`), cuatro registros **A** con nombre `@` y estos valores:
     `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
     Y un registro **CNAME** con nombre `www` y valor `TU_USUARIO.github.io`.
   - **Si usas un subdominio** (`app.jabelya.com`): un solo registro **CNAME** con nombre `app` y valor `TU_USUARIO.github.io`.
4. Espera de 10 minutos a 24 horas. Cuando GitHub diga que el DNS está bien, marca **Enforce HTTPS** (necesario para cámara, GPS e instalación).
5. Abre la app en la dirección nueva, **entra de nuevo** en cada celular y **vuelve a instalarla** (para el navegador es otra app). Lo que no se haya subido al Sheet en la dirección vieja se queda allí: sincroniza antes de cambiar.

La guía oficial está en <https://docs.github.com/es/pages/configuring-a-custom-domain-for-your-github-pages-site>.

---

## Hacer cambios

- Las dos apps usan los mismos `app.js` y `styles.css`. La página `dueno/index.html` es una copia de `index.html`; solo cambian `<base href="../">`, el título, el manifest, el ícono y `window.APP_MODO`. Si cambias algo en `index.html`, cópialo también ahí, cuidando esas líneas.
- **Precio del garrafón**: app del dueño → Ajustes → Precio por defecto.
- **Productos**: en `index.html`, busca `<select name="producto">` y cambia las líneas `<option>`.
- **Colores**: al inicio de `styles.css` (`--marino`, `--azul`, `--celeste`).
- **Textos de los stickers**: en `app.js`, busca `const STICKERS`.
- **Centro del mapa**: en `app.js`, `CENTRO_GT`.
- Después de subir cambios, cierra y vuelve a abrir la app en el celular.

## Créditos

Mapa: [Leaflet](https://leafletjs.com) y © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright).
