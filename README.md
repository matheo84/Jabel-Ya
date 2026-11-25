# Jabel Ya´ · Pedidos de agua pura

<img src="assets/logo.jpg" alt="Purificadora Jabel Ya´" width="200">

Aplicación para el celular de la purificadora **Jabel Ya´**, agua pura, vida sana (WhatsApp **4237 2018**).

## Qué hace

- **Registrar pedidos**: cliente, teléfono, dirección, referencia, producto, cantidad, precio, notas y repartidor. El total se calcula solo.
- **Clientes frecuentes**: la casa, la foto y el GPS se guardan una sola vez. En **Nuevo → Repetir pedido** (o en **Clientes → ↻ Repetir pedido**) se registra el mismo pedido de la última vez con **un toque**. Marca a los clientes con ⭐ en su ficha para que salgan primero.
- **Entregar y cobrar**: al marcar entregado, la app pregunta **💵 Pagó** o **📒 Queda fiado**. Los fiados aparecen en **Pedidos → Por cobrar** y se cobran con **💵 Cobrar**.
- **Mapa del repartidor**: las casas con pedido pendiente (el número del globo es la cantidad de garrafones). Al tocar una casa: qué llevar, cuánto cobrar, la foto, y los botones **Entregado**, **Cómo llegar** (Google Maps), **Llamar** y **Avisar**.
- **Fotos y punto GPS de cada casa**, con la cámara y el GPS del celular, o tocando el mapa.
- **Reportes** (solo administrador): ventas por **día, semana y mes** (con flechas para ver periodos anteriores), garrafones entregados, cobrado, fiado, ventas por producto y por repartidor, y la lista de **cobros pendientes** con los **garrafones fiados** de cada cliente, con botones para cobrar o recordar por WhatsApp.
- **Usuarios**: el **administrador** ve y hace todo. El **repartidor** entra con su usuario y PIN y **solo ve los pedidos que le asignaste**: puede marcarlos entregados, cobrar, avisar al cliente y guardar fotos y GPS de esas casas. No puede crear ni borrar pedidos ni ver reportes.
- **Avisos con stickers** por WhatsApp: “Con gusto llegamos”, “El repartidor está en camino”, “¡Gracias por su preferencia!” y “¡Estamos a la orden!”.
- **Google Sheets** como base de datos: el celular del dueño y el del repartidor ven lo mismo. Las fotos van a Google Drive.
- **Se instala en el celular** como app (con el logo de Jabel Ya´ y sin la barra del navegador) y abre aunque no haya señal.

Cada celular guarda una copia de los datos, así que la app sigue funcionando sin señal. Cuando vuelve el internet, los cambios se suben solos (cada minuto y unos segundos después de cada cambio). Arriba se ve el estado: **✓ Sheets 10:35** (todo subido), **⟳ 2 por subir** o **Sin señal**. Al tocarlo se sincroniza en ese momento.

---

## Archivos del proyecto

```
index.html             Pantallas de la app
styles.css             Colores y diseño
app.js                 Lógica: pedidos, cobros, reportes, mapa, usuarios
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
5. Arrastra **todo el contenido** de esta carpeta (los archivos y las carpetas `icons`, `assets`, `google-apps-script` y `vendor`, no la carpeta de afuera) y toca **Commit changes**.

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

1. Abre tu app (`https://TU_USUARIO.github.io/jabel-ya/`).
2. Escribe tu usuario (`juan`), tu PIN, y en **Dirección de Google Sheets** pega la URL del script.
3. Toca **Entrar**. Si ya tenías pedidos en ese celular, se suben a la hoja.

> La dirección del script de Jabel Ya´ ya viene escrita en `app.js` (`API_PREDETERMINADA`), así que en la pantalla de entrar solo hace falta usuario y PIN. Si algún día publicas el script con otra URL, cámbiala ahí.

---

## 3. Agregar al repartidor

1. En tu app: **Ajustes → Usuarios → Agregar usuario**.
2. Escribe el usuario (por ejemplo `pedro`, sin espacios ni tildes), el nombre, el rol **Repartidor** y un **PIN**. Toca **Guardar usuario**.
3. Toca **Copiar enlace para el repartidor** y mándaselo por WhatsApp junto con su usuario y PIN. El enlace ya trae la dirección de Google Sheets, así que él solo escribe usuario y PIN.
4. Al registrar un pedido, elige en **Repartidor** a quién le toca. El repartidor solo ve los pedidos asignados a él. Los pedidos “Sin asignar” solo los ve el administrador.

Desde **Usuarios** puedes **Editar** (cambiar nombre, rol o PIN), **desactivar** o **borrar** a un usuario. Cada quien puede cambiar su PIN en **Ajustes → Mi cuenta → Cambiar mi PIN**. Al **Cerrar sesión**, los datos se borran de ese celular (siguen en el Sheet).

---

## 4. Instalarla en el celular

- **Android (Chrome)**: al abrir la app aparece el aviso **Instala Jabel Ya´ en tu celular → Instalar**. También en **Ajustes → 📲 Instalar app**, o en el menú ⋮ → **Instalar app**.
- **iPhone (Safari)**: botón **Compartir** (cuadro con flecha) → **Agregar a inicio**.

Queda en la pantalla de inicio con el logo de Jabel Ya´ y se abre como app normal. La primera vez que uses **Mi ubicación** o **Tomar foto**, acepta los permisos.

---

## 5. Cómo se usa en el día

1. **Nuevo**: toca un cliente frecuente en **Repetir pedido**, o llena el formulario para un cliente nuevo y elige el repartidor.
2. **Clientes**: la primera vez, abre la casa, toca **📷 Tomar foto** y **📍 Guardar mi ubicación actual** estando frente a la casa. Marca ⭐ si es cliente frecuente.
3. **Mapa**: el repartidor ve sus casas pendientes, toca **Cómo llegar** y, al entregar, **✓ Entregado → Pagó / Queda fiado**.
4. **Avisar**: manda el sticker y el mensaje por WhatsApp.
5. **Reportes**: revisa la venta del día, la semana o el mes y cobra los fiados.

---

## Qué hay en la hoja de Google

- **Pedidos**: cliente, producto, cantidad, precio, total, estado (`pendiente`/`entregado`), pagado (`si`/`no`), repartidor, notas y fechas de pedido, entrega y pago. Sirve para tus cuentas y filtros.
- **Clientes**: nombre, teléfono, zona, dirección, referencia, frecuente, GPS y enlaces a las fotos.
- **Usuarios**: usuario, nombre, rol y activo. El PIN se guarda **cifrado**, nadie lo puede leer (ni tú). Si alguien olvida su PIN, cámbialo desde **Ajustes → Usuarios → Editar**.
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

- **Precio del garrafón**: Ajustes → Precio por defecto.
- **Productos**: en `index.html`, busca `<select name="producto">` y cambia las líneas `<option>`.
- **Colores**: al inicio de `styles.css` (`--marino`, `--azul`, `--celeste`).
- **Textos de los stickers**: en `app.js`, busca `const STICKERS`.
- **Centro del mapa**: en `app.js`, `CENTRO_GT`.
- Después de subir cambios, cierra y vuelve a abrir la app en el celular.

## Créditos

Mapa: [Leaflet](https://leafletjs.com) y © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright).
