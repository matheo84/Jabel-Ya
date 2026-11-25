/**
 * Jabel Ya´ — API para guardar pedidos, clientes y usuarios en Google Sheets.
 *
 * Cómo instalarlo: lee la sección "Conectar con Google Sheets" del README.
 * Resumen: Extensiones → Apps Script, pega este código, cambia ADMIN_PIN,
 * ejecuta "instalar", luego Implementar → Nueva implementación → Aplicación web
 * (Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario).
 */

// 1) Primer usuario administrador. Se crea solo la primera vez (si la hoja Usuarios está vacía).
//    CAMBIA EL PIN antes de ejecutar "instalar". Después puedes cambiarlo desde la app.
const ADMIN_USUARIO = 'juan';
const ADMIN_NOMBRE = 'Juan';
const ADMIN_PIN = '1234';

const ZONA_HORARIA = 'America/Guatemala';
const CARPETA_FOTOS = 'Jabel Ya - Fotos de casas';

// Columnas de cada hoja. "cliente" y "fecha_..." son solo para leer cómodo en el Sheet.
const TABLAS = {
  Clientes: ['id', 'nombre', 'telefono', 'zona', 'direccion', 'referencia', 'frecuente', 'lat', 'lng', 'precision', 'fotos', 'creado', 'actualizado'],
  Pedidos: ['id', 'cliente', 'producto', 'cantidad', 'precio', 'total', 'estado', 'pagado', 'repartidor', 'notas', 'fecha_pedido', 'fecha_entrega', 'fecha_pago', 'clienteId', 'creado', 'entregadoEn', 'pagadoEn', 'actualizado'],
  Usuarios: ['usuario', 'nombre', 'rol', 'activo', 'pin_cifrado'],
};
const NUMEROS = ['lat', 'lng', 'precision', 'cantidad', 'precio', 'total', 'creado', 'entregadoEn', 'pagadoEn', 'actualizado'];
const BOOLEANOS = ['frecuente', 'pagado', 'activo'];
const SOLO_LECTURA = ['cliente', 'fecha_pedido', 'fecha_entrega', 'fecha_pago'];

// Lo que un repartidor puede cambiar (solo en sus pedidos y en las casas de esos pedidos).
const CAMPOS_REPARTIDOR = {
  Pedidos: ['estado', 'entregadoEn', 'pagado', 'pagadoEn', 'actualizado'],
  Clientes: ['telefono', 'referencia', 'lat', 'lng', 'precision', 'fotos', 'actualizado'],
};

function doGet() {
  return responder({ ok: true, app: 'jabelya', mensaje: 'La API de Jabel Ya´ está funcionando.' });
}

function doPost(e) {
  let datos;
  try { datos = JSON.parse(e.postData.contents); } catch (err) { return responder({ ok: false, error: 'Datos inválidos' }); }

  const candado = LockService.getScriptLock();
  candado.waitLock(30000);
  try {
    const yo = autenticar(datos.usuario, datos.pin);
    if (!yo) return responder({ ok: false, error: 'Usuario o PIN incorrecto' });
    const soloAdmin = () => { if (yo.rol !== 'admin') throw new Error('Solo el administrador puede hacer esto'); };

    switch (datos.accion) {
      case 'entrar':
        return responder({ ok: true, usuario: yo.usuario, nombre: yo.nombre, rol: yo.rol });
      case 'foto':
        return responder({ ok: true, url: guardarFoto(datos) });
      case 'sync':
        return responder(sincronizar(datos, yo));
      case 'usuarios':
        soloAdmin();
        return responder({ ok: true, usuarios: listaUsuarios() });
      case 'guardarUsuario':
        soloAdmin();
        guardarUsuario(datos.datos || {}, yo);
        return responder({ ok: true, usuarios: listaUsuarios() });
      case 'cambiarPin':
        guardarUsuario({ usuario: yo.usuario, nombre: yo.nombre, rol: yo.rol, activo: true, pin: datos.nuevoPin }, yo);
        return responder({ ok: true });
      default:
        return responder({ ok: false, error: 'Acción desconocida' });
    }
  } catch (err) {
    return responder({ ok: false, error: err.message || String(err) });
  } finally {
    candado.releaseLock();
  }
}

/* ---------------- Usuarios ---------------- */

function cifrar(usuario, pin) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'jabelya:' + String(usuario).toLowerCase() + ':' + String(pin));
  return bytes.map((b) => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function leerUsuarios() {
  const h = hoja('Usuarios');
  let lista = leer(h, TABLAS.Usuarios);
  if (!lista.length) {
    lista = [{ usuario: ADMIN_USUARIO.toLowerCase(), nombre: ADMIN_NOMBRE, rol: 'admin', activo: true, pin_cifrado: cifrar(ADMIN_USUARIO, ADMIN_PIN) }];
    guardarFilas(h, TABLAS.Usuarios, lista);
  }
  return lista;
}

// Después de 5 PIN equivocados, ese usuario queda bloqueado 15 minutos (protege contra adivinar el PIN).
const MAX_INTENTOS = 5;
const BLOQUEO_SEGUNDOS = 15 * 60;

function autenticar(usuario, pin) {
  if (!usuario || !pin) return null;
  const nombre = String(usuario).trim().toLowerCase();
  const cache = CacheService.getScriptCache();
  const llave = 'fallos:' + nombre;
  const fallos = Number(cache.get(llave) || 0);
  if (fallos >= MAX_INTENTOS) throw new Error('Demasiados intentos con PIN equivocado. Espera 15 minutos.');
  const u = leerUsuarios().find((x) => x.usuario === nombre);
  if (!u || !u.activo || u.pin_cifrado !== cifrar(u.usuario, pin)) {
    cache.put(llave, String(fallos + 1), BLOQUEO_SEGUNDOS);
    return null;
  }
  if (fallos) cache.remove(llave);
  return u;
}

function listaUsuarios() {
  return leerUsuarios().map((u) => ({ usuario: u.usuario, nombre: u.nombre, rol: u.rol, activo: u.activo }));
}

function guardarUsuario(d, yo) {
  const usuario = String(d.usuario || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,20}$/.test(usuario)) throw new Error('El usuario debe tener de 3 a 20 letras o números, sin espacios ni tildes');
  const lista = leerUsuarios();
  if (d.borrar) {
    if (usuario === yo.usuario) throw new Error('No puedes borrar tu propio usuario');
    guardarFilas(hoja('Usuarios'), TABLAS.Usuarios, lista.filter((x) => x.usuario !== usuario));
    return;
  }
  const rol = d.rol === 'admin' ? 'admin' : 'repartidor';
  if (usuario === yo.usuario && (rol !== 'admin' && yo.rol === 'admin' || d.activo === false)) throw new Error('No puedes quitarte el acceso a ti mismo');
  let u = lista.find((x) => x.usuario === usuario);
  if (!u) {
    if (!d.pin) throw new Error('Escribe un PIN para el usuario nuevo');
    u = { usuario };
    lista.push(u);
  }
  u.nombre = String(d.nombre || usuario).trim();
  u.rol = rol;
  u.activo = d.activo !== false;
  if (d.pin) {
    if (!/^\d{4,8}$/.test(String(d.pin))) throw new Error('El PIN debe tener de 4 a 8 números');
    u.pin_cifrado = cifrar(usuario, d.pin);
  }
  guardarFilas(hoja('Usuarios'), TABLAS.Usuarios, lista);
}

/* ---------------- Pedidos y clientes ---------------- */

function sincronizar(datos, yo) {
  const admin = yo.rol === 'admin';
  const hC = hoja('Clientes'), hP = hoja('Pedidos');
  const clientes = indexar(leer(hC, TABLAS.Clientes));
  const pedidos = indexar(leer(hP, TABLAS.Pedidos));
  const borrados = admin ? (datos.borrados || []) : []; // el repartidor no borra

  // Pedidos
  (datos.pedidos || []).forEach((nuevo) => {
    if (!nuevo || !nuevo.id) return;
    const viejo = pedidos[nuevo.id];
    if (viejo && Number(viejo.actualizado || 0) > Number(nuevo.actualizado || 0)) return; // gana el más reciente
    if (admin) { pedidos[nuevo.id] = nuevo; return; }
    if (!viejo || viejo.repartidor !== yo.usuario) return;
    CAMPOS_REPARTIDOR.Pedidos.forEach((k) => { if (k in nuevo) viejo[k] = nuevo[k]; });
  });
  borrados.filter((b) => b.tabla === 'pedidos').forEach((b) => { delete pedidos[b.id]; });

  // Clientes
  const misClientes = {};
  Object.keys(pedidos).forEach((id) => { if (pedidos[id].repartidor === yo.usuario) misClientes[pedidos[id].clienteId] = true; });
  (datos.clientes || []).forEach((nuevo) => {
    if (!nuevo || !nuevo.id) return;
    const viejo = clientes[nuevo.id];
    if (viejo && Number(viejo.actualizado || 0) > Number(nuevo.actualizado || 0)) return;
    if (admin) { clientes[nuevo.id] = nuevo; return; }
    if (!viejo || !misClientes[nuevo.id]) return;
    CAMPOS_REPARTIDOR.Clientes.forEach((k) => { if (k in nuevo) viejo[k] = nuevo[k]; });
  });
  borrados.filter((b) => b.tabla === 'clientes').forEach((b) => { delete clientes[b.id]; });

  const listaC = valores(clientes), listaP = valores(pedidos);
  const nombres = {};
  listaC.forEach((c) => { nombres[c.id] = c.nombre; });
  guardarFilas(hC, TABLAS.Clientes, listaC);
  guardarFilas(hP, TABLAS.Pedidos, listaP, nombres);

  if (admin) return { ok: true, clientes: listaC, pedidos: listaP, usuarios: listaUsuarios(), hora: Date.now() };
  const susPedidos = listaP.filter((p) => p.repartidor === yo.usuario);
  const ids = {};
  susPedidos.forEach((p) => { ids[p.clienteId] = true; });
  return { ok: true, clientes: listaC.filter((c) => ids[c.id]), pedidos: susPedidos, hora: Date.now() };
}

/* ---------------- Utilidades de hoja ---------------- */

function encabezado(h, cols) {
  h.getRange(1, 1, 1000, cols.length).setNumberFormat('@'); // todo como texto (respeta teléfonos)
  h.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#050a30').setFontColor('#ffffff');
  h.setFrozenRows(1);
}

function hoja(nombre) {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let h = libro.getSheetByName(nombre);
  const cols = TABLAS[nombre];
  if (!h) h = libro.insertSheet(nombre);
  if (h.getLastRow() === 0) {
    encabezado(h, cols);
  } else {
    // Si la hoja viene de una versión anterior, acomoda las columnas nuevas sin perder datos.
    const actuales = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
    if (cols.some((c, i) => actuales[i] !== c)) {
      const viejos = leer(h, actuales);
      h.clearContents();
      encabezado(h, cols);
      guardarFilas(h, cols, viejos);
    }
  }
  return h;
}

function leer(h, cols) {
  const n = h.getLastRow() - 1;
  if (n < 1) return [];
  return h.getRange(2, 1, n, cols.length).getValues()
    .filter((fila) => fila[0] !== '')
    .map((fila) => {
      const o = {};
      cols.forEach((c, i) => {
        if (!c || SOLO_LECTURA.indexOf(c) >= 0) return;
        let v = fila[i];
        if (NUMEROS.indexOf(c) >= 0) v = v === '' || v === null ? null : Number(v);
        else if (BOOLEANOS.indexOf(c) >= 0) v = v === true || ['true', 'si', 'sí'].indexOf(String(v).toLowerCase()) >= 0;
        else if (c === 'fotos') v = String(v || '').split(' | ').filter(String);
        else v = String(v === null ? '' : v);
        o[c] = v;
      });
      return o;
    });
}

function guardarFilas(h, cols, lista, nombresClientes) {
  lista = lista.slice().sort((a, b) => Number(a.creado || 0) - Number(b.creado || 0));
  const fecha = (t) => (t ? Utilities.formatDate(new Date(Number(t)), ZONA_HORARIA, 'dd/MM/yyyy HH:mm') : '');
  const filas = lista.map((o) => cols.map((c) => {
    if (c === 'cliente') return (nombresClientes && nombresClientes[o.clienteId]) || '';
    if (c === 'fecha_pedido') return fecha(o.creado);
    if (c === 'fecha_entrega') return fecha(o.entregadoEn);
    if (c === 'fecha_pago') return fecha(o.pagadoEn);
    if (c === 'fotos') return (o.fotos || []).join(' | ');
    if (BOOLEANOS.indexOf(c) >= 0) return o[c] ? 'si' : 'no';
    const v = o[c];
    return v === null || v === undefined ? '' : String(v);
  }));
  const ultima = h.getLastRow();
  if (ultima > 1) h.getRange(2, 1, ultima - 1, cols.length).clearContent();
  if (filas.length) h.getRange(2, 1, filas.length, cols.length).setNumberFormat('@').setValues(filas);
}

function indexar(lista) { const o = {}; lista.forEach((x) => { o[x.id] = x; }); return o; }
function valores(o) { return Object.keys(o).map((k) => o[k]); }

/** Guarda una foto en Google Drive y devuelve un enlace para verla. */
function guardarFoto(datos) {
  const partes = String(datos.imagen || '').split(',');
  if (partes.length !== 2) throw new Error('Foto inválida');
  const tipo = (partes[0].match(/data:(.*?);/) || [])[1] || 'image/jpeg';
  const blob = Utilities.newBlob(Utilities.base64Decode(partes[1]), tipo, (datos.nombre || 'casa') + '.jpg');
  const carpetas = DriveApp.getFoldersByName(CARPETA_FOTOS);
  const carpeta = carpetas.hasNext() ? carpetas.next() : DriveApp.createFolder(CARPETA_FOTOS);
  const archivo = carpeta.createFile(blob);
  archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/thumbnail?id=' + archivo.getId() + '&sz=w1200';
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Ejecuta esta función una vez desde el editor: crea las hojas, el administrador y pide los permisos. */
function instalar() {
  hoja('Clientes');
  hoja('Pedidos');
  leerUsuarios();
  const carpetas = DriveApp.getFoldersByName(CARPETA_FOTOS);
  if (!carpetas.hasNext()) DriveApp.createFolder(CARPETA_FOTOS);
  Logger.log('Listo. Usuario administrador: ' + ADMIN_USUARIO + '. Ahora: Implementar → Nueva implementación → Aplicación web.');
}
