/* Base de datos local (IndexedDB) de Jabel Ya´.
   Todo se guarda en el celular, sin servidor. Si el navegador no permite
   IndexedDB, se usa memoria (los datos se pierden al cerrar). */
const DB = (() => {
  const NOMBRE = 'jabelya';
  const VERSION = 1;
  const TABLAS = ['clientes', 'pedidos'];
  let conexion = null;
  const memoria = { clientes: new Map(), pedidos: new Map() };
  let soloMemoria = false;

  function abrir() {
    if (conexion || soloMemoria) return Promise.resolve(conexion);
    return new Promise((resolve) => {
      let req;
      try { req = indexedDB.open(NOMBRE, VERSION); }
      catch (e) { soloMemoria = true; return resolve(null); }
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const t of TABLAS) {
          if (!db.objectStoreNames.contains(t)) db.createObjectStore(t, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => { conexion = req.result; resolve(conexion); };
      req.onerror = () => { soloMemoria = true; resolve(null); };
    });
  }

  function tx(tabla, modo, fn) {
    return abrir().then((db) => {
      if (!db) return fn(null);
      return new Promise((resolve, reject) => {
        const t = db.transaction(tabla, modo);
        const store = t.objectStore(tabla);
        let resultado;
        Promise.resolve(fn(store)).then((r) => { resultado = r; });
        t.oncomplete = () => resolve(resultado);
        t.onerror = () => reject(t.error);
      });
    });
  }

  const pedir = (req) => new Promise((ok, mal) => { req.onsuccess = () => ok(req.result); req.onerror = () => mal(req.error); });

  return {
    get modoMemoria() { return soloMemoria; },
    abrir,
    todos(tabla) {
      return abrir().then((db) => {
        if (!db) return [...memoria[tabla].values()];
        return pedir(db.transaction(tabla).objectStore(tabla).getAll());
      });
    },
    uno(tabla, id) {
      return abrir().then((db) => {
        if (!db) return memoria[tabla].get(id);
        return pedir(db.transaction(tabla).objectStore(tabla).get(id));
      });
    },
    guardar(tabla, obj) {
      return tx(tabla, 'readwrite', (s) => {
        if (!s) { memoria[tabla].set(obj.id, obj); return obj; }
        s.put(obj); return obj;
      });
    },
    borrar(tabla, id) {
      return tx(tabla, 'readwrite', (s) => {
        if (!s) { memoria[tabla].delete(id); return; }
        s.delete(id);
      });
    },
    vaciar(tabla) {
      return tx(tabla, 'readwrite', (s) => {
        if (!s) { memoria[tabla].clear(); return; }
        s.clear();
      });
    },
  };
})();
