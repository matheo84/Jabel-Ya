/* Jabel Ya´ — pedidos, entregas y mapa del repartidor. */
{
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const Q = (n) => 'Q' + Number(n || 0).toFixed(2);
  const hoy = () => new Date().toDateString();
  const fecha = (t) => new Date(t).toLocaleString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const CENTRO_GT = [14.6349, -90.5069];
  const NEGOCIO = 'Jabel Ya´';
  // Cada página dice qué app es: 'pedidos' (index.html, también la usa el repartidor) o 'dueno' (dueno/)
  const MODO = ['pedidos', 'dueno'].includes(window.APP_MODO) ? window.APP_MODO : 'pedidos';
  const VISTAS = { pedidos: ['pedidos', 'nuevo', 'mapa', 'clientes', 'ajustes'], dueno: ['reportes', 'cobros', 'usuarios', 'ajustes'] }[MODO];
  const INICIO = VISTAS[0];
  let miPos = null;
  document.body.dataset.modo = MODO;

  let clientes = [];
  let pedidos = [];
  let filtro = 'pendiente';
  let ajustes = { precio: 15, ultimoRepartidor: '' };
  try { Object.assign(ajustes, JSON.parse(localStorage.getItem('jabelya-ajustes') || '{}')); } catch (e) { /* sin localStorage */ }

  /* ---------- Utilidades de interfaz ---------- */
  let toastT;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600);
  }

  function confirmar(texto) {
    const d = $('#dlg-confirmar');
    $('#confirmar-texto').textContent = texto;
    d.showModal();
    return new Promise((ok) => {
      const fin = (v) => { d.close(); $('#confirmar-si').onclick = $('#confirmar-no').onclick = null; ok(v); };
      $('#confirmar-si').onclick = () => fin(true);
      $('#confirmar-no').onclick = () => fin(false);
    });
  }

  function ubicacionActual() {
    // Si el GPS del mapa ya está activo y es reciente, se usa esa posición (más rápido).
    if (miPos && Date.now() - miPos.t < 20000) return Promise.resolve({ lat: miPos.lat, lng: miPos.lng, precision: miPos.precision });
    return new Promise((ok, mal) => {
      if (!navigator.geolocation) return mal(new Error('Este celular no permite GPS en el navegador.'));
      navigator.geolocation.getCurrentPosition(
        (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude, precision: Math.round(p.coords.accuracy) }),
        (e) => mal(new Error(e.code === 1 ? 'Permiso de ubicación denegado. Actívalo en el navegador.' : 'No se pudo obtener la ubicación. Sal al aire libre e intenta de nuevo.')),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
    });
  }

  const telLimpio = (t) => String(t || '').replace(/\D/g, '');
  const linkWhats = (c, texto) => {
    const n = telLimpio(c.telefono);
    if (!n) return '';
    const num = n.length === 8 ? '502' + n : n;
    return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
  };
  const linkRuta = (c) => `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`;
  const clientePor = (id) => clientes.find((c) => c.id === id) || { nombre: '(cliente borrado)' };

  /* ---------- Navegación ---------- */
  function mostrar(vista) {
    if (vista !== 'entrar' && !VISTAS.includes(vista)) vista = INICIO;
    if (rol() === 'repartidor' && ['nuevo', 'reportes', 'cobros', 'usuarios'].includes(vista)) vista = MODO === 'dueno' ? 'ajustes' : INICIO;
    document.body.classList.toggle('sin-sesion', vista === 'entrar');
    $$('.view').forEach((v) => { v.hidden = v.id !== 'v-' + vista; });
    $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.view === vista));
    if (vista !== 'mapa' && $('#siguiente')) $('#siguiente').hidden = true;
    if (vista === 'mapa') abrirMapa();
    if (vista === 'clientes') pintarClientes();
    if (vista === 'pedidos') pintarPedidos();
    if (vista === 'ajustes') { $('#form-ajustes').precio.value = ajustes.precio; pintarCuenta(); pintarInstalar(); }
    if (vista === 'reportes' || vista === 'cobros') pintarReportes();
    if (vista === 'usuarios' && conectado()) cargarUsuarios();
    if (vista === 'entrar') prepararEntrar();
    if (vista === 'nuevo') { if (!$('#form-pedido').id.value) limpiarPedido(); pintarFrecuentes(); }
    $('main').scrollTop = 0;
  }
  $$('.tabs button').forEach((b) => {
    b.hidden = !b.dataset.modo.split(' ').includes(MODO);
    b.addEventListener('click', () => mostrar(b.dataset.view));
  });
  $('#app-nombre').textContent = { pedidos: 'Agua pura, vida sana', dueno: 'App del dueño' }[MODO];
  const irAjustes = () => { if (!$('#v-entrar').hidden) return; mostrar('ajustes'); };
  $('#brand').addEventListener('click', irAjustes);
  $('#brand').addEventListener('keydown', (e) => { if (e.key === 'Enter') irAjustes(); });

  function medirEncabezado() {
    document.documentElement.style.setProperty('--map-top', $('.top').offsetHeight + 'px');
    if (mapa) mapa.invalidateSize();
  }
  addEventListener('resize', medirEncabezado);

  /* ---------- Resumen ---------- */
  function pintarStats() {
    const pend = pedidos.filter((p) => p.estado === 'pendiente').length;
    const entHoy = pedidos.filter((p) => p.estado === 'entregado' && new Date(p.entregadoEn).toDateString() === hoy());
    const venta = entHoy.reduce((s, p) => s + p.total, 0);
    $('#stats').innerHTML = `
      <div class="stat"><b>${pend}</b><span>Por entregar</span></div>
      <div class="stat"><b>${entHoy.length}</b><span>Entregados hoy</span></div>
      <div class="stat"><b>${Q(venta)}</b><span>Venta de hoy</span></div>`;
    requestAnimationFrame(medirEncabezado);
  }

  /* ---------- Pedidos ---------- */
  $$('#v-pedidos .seg button').forEach((b) => b.addEventListener('click', () => {
    filtro = b.dataset.filtro;
    $$('#v-pedidos .seg button').forEach((x) => x.classList.toggle('on', x === b));
    pintarPedidos();
  }));
  $('#buscar').addEventListener('input', () => pintarPedidos());

  function pintarPedidos() {
    const q = $('#buscar').value.trim().toLowerCase();
    let lista = pedidos.filter((p) => filtro === 'todos' || (filtro === 'cobrar' ? p.estado === 'entregado' && !p.pagado : p.estado === filtro));
    if (q) lista = lista.filter((p) => { const c = clientePor(p.clienteId); return [c.nombre, c.direccion, c.zona, c.referencia, c.telefono].join(' ').toLowerCase().includes(q); });
    lista.sort((a, b) => filtro === 'entregado' || filtro === 'cobrar' ? b.entregadoEn - a.entregadoEn : a.creado - b.creado);
    if (MODO === 'pedidos' && miPos && filtro === 'pendiente') lista.sort((a, b) => (distA(clientePor(a.clienteId)) ?? 1e9) - (distA(clientePor(b.clienteId)) ?? 1e9));
    const ul = $('#lista-pedidos');
    if (!lista.length) {
      const sinNada = !pedidos.length && !clientes.length;
      ul.innerHTML = `<li class="vacio"><img src="assets/stickers/a-la-orden.webp" alt="¡Estamos a la orden!">${filtro === 'pendiente' ? 'No hay pedidos pendientes.' : 'No hay pedidos aquí.'}<br><br>
        <button class="btn primario solo-admin" data-acc="nuevo">+ Registrar pedido</button>
        ${sinNada && !conectado() ? '<br><br><button class="btn" data-acc="ejemplo">Cargar datos de ejemplo</button>' : ''}</li>`;
      return;
    }
    ul.innerHTML = lista.map((p) => {
      const c = clientePor(p.clienteId);
      const ent = p.estado === 'entregado';
      const fiado = ent && !p.pagado;
      const dk = ent ? null : distA(c);
      return `<li class="item ${ent ? (fiado ? 'fiado' : 'entregado') : ''}" data-id="${esc(p.id)}">
        <div class="cab"><h3>${esc(c.nombre)}</h3><span class="precio">${Q(p.total)}</span></div>
        ${dk != null ? `<div class="meta">📍 a ${textoDist(dk)} de ti</div>` : ''}
        <div>${esc(p.cantidad)} × ${esc(p.producto)} <span class="meta">(${Q(p.precio)} c/u)</span></div>
        ${c.direccion || c.zona || c.referencia ? `<div class="meta">${esc([c.direccion, c.zona].filter(Boolean).join(', '))}${c.referencia ? ' · ' + esc(c.referencia) : ''}</div>` : ''}
        ${p.notas ? `<div class="meta">📝 ${esc(p.notas)}</div>` : ''}
        ${p.repartidor ? `<div class="meta">🚚 ${esc(nombreUsuario(p.repartidor))}</div>` : ''}
        <div class="meta">Pedido: ${fecha(p.creado)}${ent ? ' · Entregado: ' + fecha(p.entregadoEn) : ''}
          ${ent ? (fiado ? '<span class="chip fiado">Fiado</span>' : '<span class="chip ok">Pagado</span>') : '<span class="chip">Pendiente</span>'}
          ${c.lat ? '' : '<span class="chip no">Sin GPS</span>'}</div>
        <div class="acciones">
          ${ent ? '' : '<button class="btn ok" data-acc="entregar">✓ Marcar entregado</button>'}
          ${fiado ? '<button class="btn ok chico" data-acc="cobrar">💵 Cobrar</button>' : ''}
          ${c.lat ? '<button class="btn chico" data-acc="ver-mapa">Ver en mapa</button>' : ''}
          ${c.telefono ? `<a class="btn chico" href="tel:${esc(telLimpio(c.telefono))}">Llamar</a>` : ''}
          <button class="btn chico" data-acc="avisar">Avisar</button>
          <button class="btn chico" data-acc="ficha">Casa</button>
          ${ent ? '<button class="btn chico" data-acc="deshacer">Deshacer entrega</button>' : ''}
          ${ent ? '' : '<button class="btn chico solo-admin" data-acc="editar">Editar</button>'}
          <button class="btn chico peligro solo-admin" data-acc="borrar">Borrar</button>
        </div></li>`;
    }).join('');
  }

  $('#lista-pedidos').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-acc]');
    if (!b) return;
    const acc = b.dataset.acc;
    if (acc === 'nuevo') return mostrar('nuevo');
    if (acc === 'ejemplo') return cargarEjemplo();
    const p = pedidos.find((x) => x.id === b.closest('.item').dataset.id);
    if (!p) return;
    const c = clientePor(p.clienteId);
    if (acc === 'entregar') return entregar([p]);
    if (acc === 'cobrar') { p.pagado = true; p.pagadoEn = Date.now(); await guardarCambio('pedidos', p); refrescar(); toast(`Cobrado ${Q(p.total)} ✓`); }
    if (acc === 'deshacer') { p.estado = 'pendiente'; p.entregadoEn = null; p.pagado = false; p.pagadoEn = null; await guardarCambio('pedidos', p); refrescar(); toast('Pedido regresado a pendientes'); }
    if (acc === 'ver-mapa') { mostrar('mapa'); setTimeout(() => enfocar(c), 250); }
    if (acc === 'ficha' && c.id) abrirCliente(c);
    if (acc === 'avisar') abrirAviso(c, p.estado === 'entregado' ? 'gracias' : 'en-camino', 'Avisar al cliente', p);
    if (acc === 'editar') editarPedido(p);
    if (acc === 'borrar' && await confirmar(`¿Borrar el pedido de ${c.nombre}?`)) {
      pedidos = pedidos.filter((x) => x !== p); await borrarCambio('pedidos', p.id); refrescar(); toast('Pedido borrado');
    }
  });

  function preguntarPago(lista) {
    const d = $('#dlg-entrega');
    const total = lista.reduce((s, p) => s + p.total, 0);
    const cant = lista.reduce((s, p) => s + p.cantidad, 0);
    $('#entrega-texto').textContent = `${clientePor(lista[0].clienteId).nombre}: ${cant} garrafón(es) · ${Q(total)}`;
    $('#entrega-pagado').textContent = `💵 Pagó ${Q(total)}`;
    d.showModal();
    return new Promise((ok) => {
      const fin = (v) => { d.close(); ok(v); };
      $('#entrega-pagado').onclick = () => fin('pagado');
      $('#entrega-fiado').onclick = () => fin('fiado');
      $('#entrega-cancelar').onclick = () => fin(null);
      d.oncancel = () => ok(null);
    });
  }

  async function entregar(lista) {
    const pago = await preguntarPago(lista);
    if (!pago) return;
    const ahora = Date.now();
    for (const p of lista) {
      p.estado = 'entregado'; p.entregadoEn = ahora;
      p.pagado = pago === 'pagado'; p.pagadoEn = p.pagado ? ahora : null;
      await guardarCambio('pedidos', p);
    }
    refrescar();
    toast(pago === 'pagado' ? 'Entregado y cobrado ✓' : 'Entregado · queda fiado');
    const c = clientePor(lista[0].clienteId);
    if (c.id && !c.lat && await confirmar(`Esta casa no tiene punto GPS. ¿Estás frente a la casa de ${c.nombre}? Guardar la ubicación ahora.`)) {
      try { Object.assign(c, await ubicacionActual()); await guardarCambio('clientes', c); toast('Ubicación de la casa guardada'); refrescar(); }
      catch (err) { toast(err.message); }
    }
    if (c.id) await abrirAviso(c, 'gracias', '¡Pedido entregado! ✓', lista[0]);
  }

  /* ---------- Nuevo / editar pedido ---------- */
  const fp = $('#form-pedido');
  function limpiarPedido(cliente) {
    fp.reset(); fp.id.value = '';
    fp.precio.value = ajustes.precio;
    pintarSelectRepartidor(ajustes.ultimoRepartidor);
    $('#titulo-pedido').textContent = 'Nuevo pedido';
    $('#hint-cliente').textContent = '';
    if (cliente) llenarCliente(cliente);
    calcTotal();
  }
  function llenarCliente(c) {
    fp.clienteNombre.value = c.nombre;
    for (const k of ['telefono', 'zona', 'direccion', 'referencia']) fp[k].value = c[k] || '';
    $('#hint-cliente').textContent = `Cliente registrado${c.lat ? ' · con punto GPS' : ' · sin punto GPS'}${c.fotos?.length ? ` · ${c.fotos.length} foto(s)` : ''}`;
  }
  function editarPedido(p) {
    mostrar('nuevo');
    const c = clientePor(p.clienteId);
    llenarCliente(c);
    fp.id.value = p.id;
    fp.producto.value = p.producto; fp.cantidad.value = p.cantidad; fp.precio.value = p.precio; fp.notas.value = p.notas || '';
    pintarSelectRepartidor(p.repartidor || '');
    $('#frecuentes-box').hidden = true;
    $('#titulo-pedido').textContent = 'Editar pedido';
    calcTotal();
  }
  function calcTotal() { $('#total').textContent = Q((+fp.cantidad.value || 0) * (+fp.precio.value || 0)); }
  fp.cantidad.addEventListener('input', calcTotal);
  fp.precio.addEventListener('input', calcTotal);
  fp.clienteNombre.addEventListener('input', () => {
    const c = clientes.find((x) => x.nombre.toLowerCase() === fp.clienteNombre.value.trim().toLowerCase());
    if (c) llenarCliente(c); else $('#hint-cliente').textContent = fp.clienteNombre.value ? 'Cliente nuevo: se guardará su casa.' : '';
  });
  $('#cancelar-pedido').addEventListener('click', () => { fp.id.value = ''; mostrar('pedidos'); });

  fp.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = fp.clienteNombre.value.trim();
    let c = clientes.find((x) => x.nombre.toLowerCase() === nombre.toLowerCase());
    if (!c) { c = { id: uid(), nombre, fotos: [], creado: Date.now() }; clientes.push(c); }
    for (const k of ['telefono', 'zona', 'direccion', 'referencia']) { const v = fp[k].value.trim(); if (v) c[k] = v; }
    await guardarCambio('clientes', c);
    const datos = {
      clienteId: c.id, producto: fp.producto.value, cantidad: +fp.cantidad.value, precio: +fp.precio.value,
      total: (+fp.cantidad.value) * (+fp.precio.value), notas: fp.notas.value.trim(),
      repartidor: fp.repartidor.value || '',
    };
    ajustes.ultimoRepartidor = datos.repartidor; guardarAjustes();
    let p = pedidos.find((x) => x.id === fp.id.value);
    if (p) Object.assign(p, datos);
    else { p = { id: uid(), estado: 'pendiente', creado: Date.now(), entregadoEn: null, pagado: false, pagadoEn: null, ...datos }; pedidos.push(p); }
    await guardarCambio('pedidos', p);
    const esNuevo = !fp.id.value;
    toast(fp.id.value ? 'Pedido actualizado' : 'Pedido registrado ✓');
    fp.id.value = '';
    refrescar();
    filtro = 'pendiente'; $$('#v-pedidos .seg button').forEach((x) => x.classList.toggle('on', x.dataset.filtro === 'pendiente'));
    mostrar('pedidos');
    if (esNuevo) abrirAviso(c, 'con-gusto', 'Pedido registrado ✓', p);
  });

  /* ---------- Mapa del repartidor ---------- */
  let mapa, capaCasas, marcadorYo, vigilancia;
  function nuevoMapa(el, centro, zoom) {
    const m = L.map(el, { zoomControl: true }).setView(centro, zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap',
    }).on('tileerror', () => avisoMapa('No se pudo cargar el mapa. Revisa tu conexión a internet.')).addTo(m);
    return m;
  }
  function avisoMapa(t) { const a = $('#map-aviso'); a.textContent = t; a.hidden = !t; }

  function abrirMapa() {
    medirEncabezado();
    if (typeof L === 'undefined') return avisoMapa('No se pudo cargar el mapa.');
    if (!mapa) {
      mapa = nuevoMapa('mapa', CENTRO_GT, 13);
      capaCasas = L.layerGroup().addTo(mapa);
      pintarMapa(true);
    } else { pintarMapa(false); }
    setTimeout(() => mapa.invalidateSize(), 50);
    if (MODO === 'pedidos') { pintarSiguiente(); if (vigilancia == null) seguirGps(true); }
  }
  $('#chk-todos').addEventListener('change', () => pintarMapa(true));

  const icono = (clase, txt) => L.divIcon({ className: '', html: `<div class="pin ${clase}"><span>${esc(txt)}</span></div>`, iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28] });

  function pintarMapa(ajustar) {
    if (!mapa) return;
    capaCasas.clearLayers();
    const todos = $('#chk-todos').checked;
    const pendPor = {};
    pedidos.filter((p) => p.estado === 'pendiente').forEach((p) => { (pendPor[p.clienteId] ||= []).push(p); });
    const casas = clientes.filter((c) => c.lat && (todos || pendPor[c.id]));
    const sinGps = Object.keys(pendPor).filter((id) => !clientePor(id).lat).length;
    avisoMapa(sinGps ? `${sinGps} casa(s) con pedido pendiente no tienen punto GPS. Guárdalo desde “Clientes”.` : (!casas.length ? (todos ? 'Aún no hay casas con punto GPS.' : 'No hay entregas pendientes con ubicación.') : ''));
    const puntos = [];
    for (const c of casas) {
      const lista = pendPor[c.id] || [];
      const cant = lista.reduce((s, p) => s + p.cantidad, 0);
      const m = L.marker([c.lat, c.lng], { icon: icono(lista.length ? '' : 'casa', lista.length ? cant : '') });
      m.bindPopup(() => popupCasa(c, lista), { maxWidth: 260 });
      m.clienteId = c.id;
      m.addTo(capaCasas);
      puntos.push([c.lat, c.lng]);
    }
    if (ajustar && puntos.length) mapa.fitBounds(puntos, { padding: [40, 40], maxZoom: 17 });
  }

  function popupCasa(c, lista) {
    const div = document.createElement('div');
    const total = lista.reduce((s, p) => s + p.total, 0);
    div.innerHTML = `<h3>${esc(c.nombre)}</h3>
      ${lista.length ? `<div><b>${lista.map((p) => `${esc(p.cantidad)} × ${esc(p.producto)}`).join('<br>')}</b></div><div>Cobrar: <b>${Q(total)}</b></div>` : '<div>Sin pedidos pendientes</div>'}
      <div>${esc([c.direccion, c.zona].filter(Boolean).join(', '))}</div>
      ${c.referencia ? `<div><i>${esc(c.referencia)}</i></div>` : ''}
      ${lista.some((p) => p.notas) ? `<div>📝 ${lista.map((p) => esc(p.notas)).filter(Boolean).join(' · ')}</div>` : ''}
      ${c.fotos?.[0] ? `<img src="${esc(c.fotos[0])}" alt="Foto de la casa">` : ''}
      <div class="acciones">
        ${lista.length ? '<button class="btn ok chico" data-p="entregar">✓ Entregado</button>' : ''}
        <a class="btn primario chico" href="${esc(linkRuta(c))}" target="_blank" rel="noopener">Cómo llegar</a>
        ${c.telefono ? `<a class="btn chico" href="tel:${esc(telLimpio(c.telefono))}">Llamar</a>` : ''}
        <button class="btn chico" data-p="avisar">Avisar</button>
        <button class="btn chico" data-p="ficha">Casa</button>
      </div>`;
    div.addEventListener('click', (e) => {
      const b = e.target.closest('[data-p]');
      if (!b) return;
      if (b.dataset.p === 'entregar') { mapa.closePopup(); entregar(lista); }
      if (b.dataset.p === 'ficha') abrirCliente(c);
      if (b.dataset.p === 'avisar') abrirAviso(c, 'en-camino', 'Avisar al cliente', lista[0]);
    });
    return div;
  }

  function enfocar(c) {
    if (!mapa || !c.lat) return;
    mapa.setView([c.lat, c.lng], 17);
    capaCasas.eachLayer((m) => { if (m.clienteId === c.id) m.openPopup(); });
  }

  let ultimaPinta = 0;
  function seguirGps(silencioso) {
    if (!navigator.geolocation) return toast('Este celular no permite GPS en el navegador.');
    if (vigilancia != null) { navigator.geolocation.clearWatch(vigilancia); }
    if (!silencioso) toast('Buscando tu ubicación…');
    let primera = true;
    vigilancia = navigator.geolocation.watchPosition((p) => {
      const ll = [p.coords.latitude, p.coords.longitude];
      miPos = { lat: ll[0], lng: ll[1], precision: Math.round(p.coords.accuracy), t: Date.now() };
      if (Date.now() - ultimaPinta > 15000 || primera) { ultimaPinta = Date.now(); pintarSiguiente(); if (MODO === 'pedidos' && !$('#v-pedidos').hidden) pintarPedidos(); }
      if (!mapa) return;
      if (!marcadorYo) marcadorYo = L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="pin yo"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }), zIndexOffset: 1000 }).addTo(mapa).bindPopup('Estás aquí');
      else marcadorYo.setLatLng(ll);
      if (primera) { mapa.setView(ll, 16); primera = false; }
    }, (e) => toast(e.code === 1 ? 'Permiso de ubicación denegado. Actívalo para ver tu posición.' : 'No se pudo obtener tu ubicación.'), { enableHighAccuracy: true, maximumAge: 5000 });
  }
  $('#btn-ubicarme').addEventListener('click', () => seguirGps(false));

  /* ---------- Clientes / casas ---------- */
  $('#buscar-cliente').addEventListener('input', pintarClientes);
  $('#btn-nuevo-cliente').addEventListener('click', () => abrirCliente({ id: '', nombre: '', fotos: [] }));

  function pintarClientes() {
    const q = $('#buscar-cliente').value.trim().toLowerCase();
    const lista = clientes.filter((c) => !q || [c.nombre, c.direccion, c.zona, c.telefono].join(' ').toLowerCase().includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    $('#dl-clientes').innerHTML = clientes.map((c) => `<option value="${esc(c.nombre)}">`).join('');
    const ul = $('#lista-clientes');
    if (!lista.length) { ul.innerHTML = '<li class="vacio">Aún no hay clientes. Se agregan solos al registrar un pedido, o con “+ Cliente”.</li>'; return; }
    ul.innerHTML = lista.map((c) => {
      const n = pedidos.filter((p) => p.clienteId === c.id).length;
      return `<li class="item" data-id="${esc(c.id)}" style="border-left-color:var(--azul);cursor:pointer">
        <div class="cab"><h3>${c.frecuente ? '⭐ ' : ''}${esc(c.nombre)}</h3><span class="meta">${n} pedido(s)</span></div>
        <div class="meta">${esc([c.telefono, c.direccion, c.zona].filter(Boolean).join(' · '))}</div>
        <div>${c.lat ? '<span class="chip ok">GPS guardado</span>' : '<span class="chip no">Sin GPS</span>'} <span class="chip">${(c.fotos || []).length} foto(s)</span></div>
        ${(c.fotos || []).length ? `<div class="mini">${c.fotos.slice(0, 4).map((f) => `<img src="${esc(f)}" alt="">`).join('')}</div>` : ''}
        <div class="acciones solo-admin"><button class="btn chico primario" data-acc="repetir">↻ Repetir pedido</button></div>
      </li>`;
    }).join('');
  }
  $('#lista-clientes').addEventListener('click', (e) => {
    const li = e.target.closest('.item');
    if (!li) return;
    const c = clientes.find((x) => x.id === li.dataset.id);
    if (e.target.closest('[data-acc=repetir]')) repetirPedido(c); else abrirCliente(c);
  });

  const dc = $('#dlg-cliente');
  const fc = $('#form-cliente');
  let enEdicion = null;
  let miniMapa, miniMarcador;

  function abrirCliente(c) {
    enEdicion = { ...c, fotos: [...(c.fotos || [])] };
    fc.id.value = c.id;
    for (const k of ['nombre', 'telefono', 'zona', 'direccion', 'referencia']) fc[k].value = c[k] || '';
    fc.frecuente.checked = !!c.frecuente;
    fc.nombre.readOnly = rol() === 'repartidor';
    $('#mini-mapa').hidden = true;
    $('#btn-borrar-cliente').hidden = !c.id;
    $('#btn-pedido-cliente').hidden = !c.id;
    pintarGps(); pintarFotos();
    dc.showModal();
  }
  function pintarGps() {
    const c = enEdicion;
    $('#gps-texto').innerHTML = c.lat
      ? `Guardado: ${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}${c.precision ? ` (±${esc(c.precision)} m)` : ''} · <a href="${esc(linkRuta(c))}" target="_blank" rel="noopener">abrir en Google Maps</a>`
      : 'Sin ubicación guardada. Párate frente a la casa y toca el botón.';
  }
  function pintarFotos() {
    $('#fotos').innerHTML = enEdicion.fotos.map((f, i) => `<img src="${esc(f)}" data-i="${i}" alt="Foto ${i + 1} de la casa">`).join('') || '<p class="hint">Sin fotos.</p>';
  }

  $('#btn-gps').addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true; b.textContent = 'Buscando GPS…';
    try { Object.assign(enEdicion, await ubicacionActual()); pintarGps(); if (miniMapa && !$('#mini-mapa').hidden) moverMini(); toast('Ubicación tomada. Toca Guardar.'); }
    catch (err) { toast(err.message); }
    b.disabled = false; b.textContent = '📍 Guardar mi ubicación actual';
  });

  $('#btn-gps-mapa').addEventListener('click', () => {
    const el = $('#mini-mapa');
    el.hidden = false;
    if (typeof L === 'undefined') return;
    if (!miniMapa) {
      miniMapa = nuevoMapa(el, CENTRO_GT, 13);
      miniMapa.on('click', (ev) => { enEdicion.lat = ev.latlng.lat; enEdicion.lng = ev.latlng.lng; enEdicion.precision = null; pintarGps(); moverMini(); });
    }
    setTimeout(() => { miniMapa.invalidateSize(); moverMini(true); }, 60);
    toast('Toca el mapa donde está la casa');
  });
  function moverMini(centrar) {
    const c = enEdicion;
    if (!c.lat) { if (centrar && mapa) miniMapa.setView(mapa.getCenter(), 15); return; }
    if (!miniMarcador) {
      miniMarcador = L.marker([c.lat, c.lng], { draggable: true, icon: icono('casa', '') }).addTo(miniMapa);
      miniMarcador.on('dragend', () => { const ll = miniMarcador.getLatLng(); enEdicion.lat = ll.lat; enEdicion.lng = ll.lng; enEdicion.precision = null; pintarGps(); });
    } else miniMarcador.setLatLng([c.lat, c.lng]);
    if (centrar) miniMapa.setView([c.lat, c.lng], 17);
  }

  /* Fotos: se reducen a 1024 px para no llenar la memoria del celular */
  function reducirFoto(archivo, max = 1024) {
    return new Promise((ok, mal) => {
      const url = URL.createObjectURL(archivo);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        ok(cv.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No se pudo leer la foto.')); };
      img.src = url;
    });
  }
  $('#in-foto').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      enEdicion.fotos.push(await reducirFoto(f)); pintarFotos();
      if (!enEdicion.lat && await confirmar('¿Guardar también tu ubicación actual como punto GPS de esta casa?')) {
        try { Object.assign(enEdicion, await ubicacionActual()); pintarGps(); } catch (err) { toast(err.message); }
      }
      toast('Foto agregada. Toca Guardar.');
    } catch (err) { toast(err.message); }
  });

  let fotoActual = -1;
  $('#fotos').addEventListener('click', (e) => {
    const img = e.target.closest('img');
    if (!img) return;
    fotoActual = +img.dataset.i;
    $('#foto-grande').src = enEdicion.fotos[fotoActual];
    $('#dlg-foto').showModal();
  });
  $('#btn-cerrar-foto').addEventListener('click', () => $('#dlg-foto').close());
  $('#btn-borrar-foto').addEventListener('click', () => { enEdicion.fotos.splice(fotoActual, 1); pintarFotos(); $('#dlg-foto').close(); toast('Foto quitada. Toca Guardar.'); });

  $('#btn-guardar-cliente').addEventListener('click', async () => {
    const nombre = fc.nombre.value.trim();
    if (!nombre) { fc.nombre.focus(); return toast('Escribe el nombre del cliente'); }
    const repetido = clientes.find((x) => x.nombre.toLowerCase() === nombre.toLowerCase() && x.id !== enEdicion.id);
    if (repetido) return toast('Ya existe un cliente con ese nombre');
    const c = enEdicion;
    c.nombre = nombre;
    for (const k of ['telefono', 'zona', 'direccion', 'referencia']) c[k] = fc[k].value.trim();
    c.frecuente = fc.frecuente.checked;
    if (!c.id) { c.id = uid(); c.creado = Date.now(); }
    try { await guardarCambio('clientes', c); }
    catch (err) { return toast('No se pudo guardar (¿memoria llena?). Borra fotos viejas.'); }
    const i = clientes.findIndex((x) => x.id === c.id);
    if (i >= 0) clientes[i] = c; else clientes.push(c);
    dc.close(); refrescar(); toast('Casa guardada ✓');
  });
  $('#btn-cerrar-cliente').addEventListener('click', () => dc.close());
  $('#btn-pedido-cliente').addEventListener('click', () => {
    const c = clientes.find((x) => x.id === enEdicion.id);
    dc.close(); if (c) repetirPedido(c);
  });
  $('#btn-borrar-cliente').addEventListener('click', async () => {
    const c = enEdicion;
    const suyos = pedidos.filter((p) => p.clienteId === c.id);
    dc.close();
    if (!await confirmar(`¿Borrar a ${c.nombre}${suyos.length ? ` y sus ${suyos.length} pedido(s)` : ''}? No se puede deshacer.`)) return dc.showModal();
    for (const p of suyos) await borrarCambio('pedidos', p.id);
    await borrarCambio('clientes', c.id);
    pedidos = pedidos.filter((p) => p.clienteId !== c.id);
    clientes = clientes.filter((x) => x.id !== c.id);
    refrescar(); toast('Cliente borrado');
  });

  /* ---------- Ajustes y copia de seguridad ---------- */
  $('#form-ajustes').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    ajustes.precio = +f.precio.value || 0;
    guardarAjustes();
    toast('Ajustes guardados');
  });

  $('#btn-exportar').addEventListener('click', () => {
    const datos = JSON.stringify({ app: 'jabelya', version: 1, fecha: new Date().toISOString(), ajustes, clientes, pedidos });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([datos], { type: 'application/json' }));
    a.download = `jabelya-copia-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Copia descargada');
  });

  $('#in-importar').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (d.app !== 'jabelya' || !Array.isArray(d.clientes) || !Array.isArray(d.pedidos)) throw new Error();
      if (!await confirmar(`La copia tiene ${d.clientes.length} clientes y ${d.pedidos.length} pedidos. ¿Reemplazar los datos de este celular?`)) return;
      await DB.vaciar('clientes'); await DB.vaciar('pedidos');
      for (const c of d.clientes) await guardarCambio('clientes', c);
      for (const p of d.pedidos) await guardarCambio('pedidos', p);
      if (d.ajustes) { Object.assign(ajustes, d.ajustes); try { localStorage.setItem('jabelya-ajustes', JSON.stringify(ajustes)); } catch (err) { /* */ } }
      await cargar(); toast('Copia importada ✓'); mostrar(INICIO);
    } catch (err) { toast('Ese archivo no es una copia válida de Jabel Ya´'); }
  });

  /* ---------- Sincronizar con Google Sheets ---------- */
  const leerLS = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch (e) { return def; } };
  const guardarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin localStorage */ } };
  let sheets = leerLS('jabelya-sheets', { url: '', usuario: '', pin: '', nombre: '', rol: '', ultima: 0 });
  let usuarios = leerLS('jabelya-usuarios', []);
  let modoLocal = leerLS('jabelya-local', false);
  const conectado = () => !!(sheets.url && sheets.usuario);
  const rol = () => (conectado() ? sheets.rol : 'admin');
  const nombreUsuario = (u) => (usuarios.find((x) => x.usuario === u) || {}).nombre || (u === sheets.usuario ? sheets.nombre : u);
  function guardarAjustes() { guardarLS('jabelya-ajustes', ajustes); }
  let borrados = leerLS('jabelya-borrados', []);
  let sincronizando = false, otraVez = false, syncT = null, estadoSync = '', errorSync = '';

  async function guardarCambio(tabla, obj) {
    obj.actualizado = Date.now();
    obj._sucio = true;
    await DB.guardar(tabla, obj);
    programarSync();
  }
  async function borrarCambio(tabla, id) {
    await DB.borrar(tabla, id);
    borrados.push({ tabla, id });
    guardarLS('jabelya-borrados', borrados);
    programarSync();
  }
  function programarSync(ms = 2500) {
    if (!conectado()) return;
    clearTimeout(syncT);
    syncT = setTimeout(() => sincronizar(), ms);
    pintarSync();
  }

  async function llamar(datos, cred = sheets) {
    let r;
    try { r = await fetch(cred.url, { method: 'POST', body: JSON.stringify({ usuario: cred.usuario, pin: cred.pin, ...datos }) }); }
    catch (e) { throw new Error('Sin conexión o la dirección del script no es correcta.'); }
    let j;
    try { j = await r.json(); }
    catch (e) { throw new Error('El script no respondió bien. Revisa que esté implementado con acceso para “Cualquier usuario”.'); }
    if (!j.ok) throw new Error(j.error || 'Error en Google Sheets');
    return j;
  }

  const limpio = (o) => { const { _sucio, ...resto } = o; return resto; };

  async function sincronizar(manual) {
    if (!conectado()) return;
    if (sincronizando) { otraVez = true; return; }
    if (navigator.onLine === false) { estadoSync = 'sin-red'; pintarSync(); return; }
    clearTimeout(syncT);
    sincronizando = true; estadoSync = 'subiendo'; pintarSync();
    const inicio = Date.now();
    try {
      const sucC = clientes.filter((c) => c._sucio);
      const sucP = pedidos.filter((p) => p._sucio);
      // 1) Subir fotos nuevas a Google Drive
      for (const c of sucC) {
        const fotos = c.fotos || [];
        for (let i = 0; i < fotos.length; i++) {
          if (!String(fotos[i]).startsWith('data:')) continue;
          const r = await llamar({ accion: 'foto', imagen: fotos[i], nombre: c.nombre });
          fotos[i] = r.url;
          await DB.guardar('clientes', c);
        }
      }
      // 2) Enviar cambios y recibir todo lo que hay en el Sheet
      const enviados = [...borrados];
      const r = await llamar({ accion: 'sync', clientes: sucC.map(limpio), pedidos: sucP.map(limpio), borrados: enviados });
      borrados = borrados.filter((b) => !enviados.some((x) => x.tabla === b.tabla && x.id === b.id));
      if (r.usuarios) { usuarios = r.usuarios; guardarLS('jabelya-usuarios', usuarios); }
      guardarLS('jabelya-borrados', borrados);
      // 3) Mezclar: se conservan los cambios hechos mientras se sincronizaba
      const mezclar = (servidor, local, tabla) => {
        const recientes = local.filter((o) => o._sucio && o.actualizado > inicio);
        const ids = new Set(recientes.map((o) => o.id));
        const fuera = new Set(borrados.filter((b) => b.tabla === tabla).map((b) => b.id));
        return [...servidor.filter((o) => !ids.has(o.id) && !fuera.has(o.id)), ...recientes];
      };
      const nuevosC = mezclar(r.clientes || [], clientes, 'clientes');
      const nuevosP = mezclar(r.pedidos || [], pedidos, 'pedidos');
      await reemplazar('clientes', nuevosC);
      await reemplazar('pedidos', nuevosP);
      clientes = nuevosC; pedidos = nuevosP;
      sheets.ultima = Date.now(); guardarLS('jabelya-sheets', sheets);
      estadoSync = 'ok'; errorSync = '';
      refrescar();
      if (manual) toast('Sincronizado con Google Sheets ✓');
    } catch (err) {
      estadoSync = 'error'; errorSync = err.message;
      if (manual) toast(err.message);
      if (/PIN incorrecto/.test(err.message)) { toast('Tu usuario o PIN cambió. Vuelve a entrar.'); salir(true); }
    } finally {
      sincronizando = false; pintarSync();
      if (otraVez) { otraVez = false; programarSync(500); }
    }
  }
  async function reemplazar(tabla, lista) {
    const ids = new Set(lista.map((o) => o.id));
    for (const o of await DB.todos(tabla)) if (!ids.has(o.id)) await DB.borrar(tabla, o.id);
    for (const o of lista) await DB.guardar(tabla, o);
  }

  function pintarSync() {
    const b = $('#sync');
    const porSubir = clientes.filter((c) => c._sucio).length + pedidos.filter((p) => p._sucio).length + borrados.length;
    const hora = sheets.ultima ? new Date(sheets.ultima).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' }) : '';
    let txt = '';
    if (!conectado()) txt = 'Usando solo este celular. Los datos no se comparten.';
    else if (estadoSync === 'subiendo') txt = '⟳ Sincronizando…';
    else if (estadoSync === 'error') txt = `⚠ Sin sincronizar${porSubir ? ` (${porSubir})` : ''}`;
    else if (estadoSync === 'sin-red') txt = `Sin señal${porSubir ? ` · ${porSubir} por subir` : ''}`;
    else if (porSubir) txt = `⟳ ${porSubir} por subir`;
    else txt = hora ? `✓ Sheets ${hora}` : '⟳ Conectando…';
    b.hidden = !conectado();
    b.textContent = txt;
    b.classList.toggle('error', estadoSync === 'error');
    b.title = errorSync || 'Sincronizar ahora';
    const e = $('#sheets-estado');
    if (e) e.textContent = conectado() ? `${txt}${errorSync ? ' · ' + errorSync : ''}` : txt;
  }
  $('#sync').addEventListener('click', () => sincronizar(true));

  /* ---------- Entrar, cuenta y roles ---------- */
  const fe = $('#form-entrar');
  // Dirección del Apps Script de Jabel Ya´ (se llena sola en la pantalla de entrar).
  const API_PREDETERMINADA = 'https://script.google.com/macros/s/AKfycbwsRz7KDfIXbmhIzPFyDd6-YLuBvgV8UQtUarj99NoXTA37zWo7y7AAbJzFhc1qPuqwCA/exec';
  const apiEnlace = new URLSearchParams(location.search).get('api') || '';

  function aplicarRol() {
    document.body.dataset.rol = rol();
    if (MODO === 'dueno' && rol() !== 'admin') setTimeout(() => toast('Esta app es solo para el dueño. Entra con un usuario administrador.'), 300);
    $('#usuarios-box').hidden = !(conectado() && rol() === 'admin');
  }

  function prepararEntrar() {
    const url = apiEnlace || sheets.url || API_PREDETERMINADA;
    fe.url.value = url;
    fe.usuario.value = sheets.usuario || '';
    fe.pin.value = '';
    $('#entrar-avanzado').open = !url;
    $('#entrar-error').textContent = '';
  }

  fe.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = fe.url.value.trim();
    const err = $('#entrar-error');
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) {
      $('#entrar-avanzado').open = true;
      err.textContent = 'Falta la dirección de Google Sheets (empieza con https://script.google.com/). Pídesela al administrador.';
      return;
    }
    const cred = { url, usuario: fe.usuario.value.trim().toLowerCase(), pin: fe.pin.value.trim() };
    const boton = fe.querySelector('button');
    boton.disabled = true; boton.textContent = 'Entrando…'; err.textContent = '';
    try {
      const r = await llamar({ accion: 'entrar' }, cred);
      const otroUsuario = sheets.usuario && sheets.usuario !== r.usuario;
      if (r.rol !== 'admin' || otroUsuario) {
        // El repartidor solo ve lo suyo: se limpia lo que hubiera en este celular.
        await DB.vaciar('clientes'); await DB.vaciar('pedidos');
        clientes = []; pedidos = []; borrados = []; guardarLS('jabelya-borrados', borrados);
      } else {
        // Administrador: lo que ya estaba en este celular se sube al Sheet.
        clientes.forEach((c) => { c._sucio = true; }); pedidos.forEach((p) => { p._sucio = true; });
      }
      sheets = { ...cred, nombre: r.nombre, rol: r.rol, ultima: 0 };
      guardarLS('jabelya-sheets', sheets);
      modoLocal = false; guardarLS('jabelya-local', false);
      if (apiEnlace) history.replaceState(null, '', location.pathname);
      aplicarRol(); refrescar(); mostrar(INICIO);
      toast(`Bienvenido, ${r.nombre}`);
      sincronizar();
    } catch (er) {
      err.textContent = er.message;
    } finally {
      boton.disabled = false; boton.textContent = 'Entrar';
    }
  });

  $('#btn-local').addEventListener('click', () => {
    modoLocal = true; guardarLS('jabelya-local', true);
    aplicarRol(); mostrar(INICIO);
  });

  async function salir(forzado) {
    const porSubir = clientes.filter((c) => c._sucio).length + pedidos.filter((p) => p._sucio).length + borrados.length;
    if (!forzado && !await confirmar(porSubir
      ? `Hay ${porSubir} cambio(s) sin subir y se perderán. ¿Cerrar sesión de todos modos?`
      : '¿Cerrar sesión? Los datos siguen guardados en Google Sheets.')) return;
    await DB.vaciar('clientes'); await DB.vaciar('pedidos');
    clientes = []; pedidos = []; borrados = []; guardarLS('jabelya-borrados', borrados);
    sheets = { url: sheets.url, usuario: sheets.usuario, pin: '', nombre: '', rol: '', ultima: 0 };
    sheets.usuario = ''; guardarLS('jabelya-sheets', sheets);
    estadoSync = ''; errorSync = '';
    aplicarRol(); refrescar(); mostrar('entrar');
  }

  function pintarCuenta() {
    const box = $('#cuenta');
    if (!conectado()) {
      box.innerHTML = `<p class="hint">Estás usando la app solo en este celular. Para compartir los pedidos con el repartidor, conéctala a Google Sheets.</p>
        <div class="acciones"><button class="btn primario" data-c="conectar">Conectar con Google Sheets</button></div>`;
      return;
    }
    box.innerHTML = `<div class="tarjeta">
        <b>${esc(sheets.nombre)}</b> <span class="chip">${sheets.rol === 'admin' ? 'Administrador' : 'Repartidor'}</span>
        <p class="hint">Usuario: ${esc(sheets.usuario)}</p>
        <p class="hint" id="sheets-estado"></p>
        <div class="acciones">
          <button class="btn primario" data-c="sync">Sincronizar ahora</button>
          <button class="btn" data-c="pin">Cambiar mi PIN</button>
          <button class="btn peligro" data-c="salir">Cerrar sesión</button>
        </div>
        <form class="form" id="form-pin" hidden>
          <label>PIN nuevo (4 a 8 números) <input name="pin" inputmode="numeric" pattern="\\d{4,8}" required autocomplete="new-password"></label>
          <button class="btn primario">Guardar PIN</button>
        </form>
      </div>`;
    pintarSync();
  }
  $('#cuenta').addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]');
    if (!b) return;
    if (b.dataset.c === 'conectar') mostrar('entrar');
    if (b.dataset.c === 'sync') sincronizar(true);
    if (b.dataset.c === 'salir') salir();
    if (b.dataset.c === 'pin') { const f = $('#form-pin'); f.hidden = !f.hidden; if (!f.hidden) f.pin.focus(); }
  });
  $('#cuenta').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nuevo = e.target.pin.value.trim();
    try {
      await llamar({ accion: 'cambiarPin', nuevoPin: nuevo });
      sheets.pin = nuevo; guardarLS('jabelya-sheets', sheets);
      e.target.hidden = true; e.target.reset(); toast('PIN cambiado ✓');
    } catch (er) { toast(er.message); }
  });

  /* ---------- Usuarios (solo administrador) ---------- */
  const fu = $('#form-usuario');
  async function cargarUsuarios() {
    pintarUsuarios();
    try {
      const r = await llamar({ accion: 'usuarios' });
      usuarios = r.usuarios; guardarLS('jabelya-usuarios', usuarios); pintarUsuarios();
    } catch (er) { /* sin internet: se usa la lista guardada */ }
  }
  function pintarUsuarios() {
    $('#lista-usuarios').innerHTML = usuarios.map((u) => `<li class="item" style="border-left-color:${u.activo ? 'var(--azul)' : 'var(--borde)'}">
      <div class="cab"><h3>${esc(u.nombre)}</h3><span class="chip">${u.rol === 'admin' ? 'Administrador' : 'Repartidor'}</span></div>
      <div class="meta">Usuario: ${esc(u.usuario)}${u.activo ? '' : ' · <b>Desactivado</b>'}</div>
      <div class="acciones"><button class="btn chico" data-u="${esc(u.usuario)}" data-a="editar">Editar</button>
      ${u.usuario === sheets.usuario ? '' : `<button class="btn chico peligro" data-u="${esc(u.usuario)}" data-a="borrar">Borrar</button>`}</div>
    </li>`).join('') || '<li class="vacio">Sin usuarios todavía.</li>';
  }
  $('#lista-usuarios').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-u]');
    if (!b) return;
    const u = usuarios.find((x) => x.usuario === b.dataset.u);
    if (b.dataset.a === 'editar') {
      fu.usuario.value = u.usuario; fu.usuario.readOnly = true; fu.nombre.value = u.nombre; fu.rol.value = u.rol; fu.pin.value = ''; fu.activo.checked = u.activo;
      $('#usuario-titulo').textContent = `Editar a ${u.nombre}`; fu.scrollIntoView({ behavior: 'smooth' });
    }
    if (b.dataset.a === 'borrar' && await confirmar(`¿Borrar el usuario ${u.usuario}? Sus pedidos se quedan en el Sheet.`)) {
      try { const r = await llamar({ accion: 'guardarUsuario', datos: { usuario: u.usuario, borrar: true } }); usuarios = r.usuarios; guardarLS('jabelya-usuarios', usuarios); pintarUsuarios(); toast('Usuario borrado'); }
      catch (er) { toast(er.message); }
    }
  });
  function limpiarUsuario() { fu.reset(); fu.usuario.readOnly = false; $('#usuario-titulo').textContent = 'Agregar usuario'; }
  $('#btn-usuario-nuevo').addEventListener('click', limpiarUsuario);
  fu.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = { usuario: fu.usuario.value.trim().toLowerCase(), nombre: fu.nombre.value.trim(), rol: fu.rol.value, pin: fu.pin.value.trim(), activo: fu.activo.checked };
    try {
      const r = await llamar({ accion: 'guardarUsuario', datos });
      usuarios = r.usuarios; guardarLS('jabelya-usuarios', usuarios);
      if (datos.usuario === sheets.usuario && datos.pin) { sheets.pin = datos.pin; guardarLS('jabelya-sheets', sheets); }
      pintarUsuarios(); limpiarUsuario(); toast('Usuario guardado ✓');
    } catch (er) { toast(er.message); }
  });
  $('#btn-enlace').addEventListener('click', async () => {
    const enlace = `${new URL('./', document.baseURI).href}?api=${encodeURIComponent(sheets.url)}`;
    try { await navigator.clipboard.writeText(enlace); toast('Enlace copiado. Envíalo al repartidor por WhatsApp.'); }
    catch (er) { $('#instalar-ayuda').textContent = enlace; toast('Copia el enlace que aparece en “Instalar en el celular”.'); }
  });

  /* ---------- Instalar como app ---------- */
  let promptInstalar = null;
  const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const esIphone = /iphone|ipad|ipod/i.test(navigator.userAgent);
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); promptInstalar = e;
    if (!leerLS('jabelya-banner-no', false)) $('#banner-instalar').hidden = false;
    pintarInstalar();
  });
  addEventListener('appinstalled', () => { promptInstalar = null; $('#banner-instalar').hidden = true; pintarInstalar(); toast('App instalada ✓'); });
  function pintarInstalar() {
    const b = $('#btn-instalar'), t = $('#instalar-ayuda');
    if (instalada()) { b.hidden = true; t.textContent = 'La app ya está instalada en este celular ✓'; return; }
    b.hidden = !promptInstalar;
    t.textContent = promptInstalar ? 'Se agrega a la pantalla de inicio con el logo de Jabel Ya´.'
      : esIphone ? 'En iPhone: abre esta página en Safari, toca Compartir (cuadro con flecha) y luego “Agregar a inicio”.'
      : 'En Android: abre esta página en Chrome, toca el menú ⋮ y luego “Instalar app” o “Agregar a la pantalla principal”.';
  }
  $$('[data-instalar]').forEach((b) => b.addEventListener('click', async () => {
    if (!promptInstalar) { mostrar('ajustes'); return; }
    promptInstalar.prompt();
    await promptInstalar.userChoice.catch(() => null);
    promptInstalar = null; $('#banner-instalar').hidden = true; pintarInstalar();
  }));
  $('#btn-banner-no').addEventListener('click', () => { $('#banner-instalar').hidden = true; guardarLS('jabelya-banner-no', true); });

  /* ---------- Avisos al cliente con stickers ---------- */
  const STICKERS = {
    'con-gusto': { alt: 'Con gusto llegamos', texto: (c, p) => `Hola ${c.nombre}, recibimos su pedido${p ? ` de ${p.cantidad} × ${p.producto}` : ''}. ¡Con gusto llegamos! ${NEGOCIO}, agua pura, vida sana.` },
    'en-camino': { alt: 'El repartidor está en camino', texto: (c, p) => { const r = p && p.repartidor ? nombreUsuario(p.repartidor) : (rol() === 'repartidor' ? sheets.nombre : ''); return `Hola ${c.nombre}, el repartidor de ${NEGOCIO}${r ? ` (${r})` : ''} está en camino con su pedido de agua pura.`; } },
    'gracias': { alt: 'Gracias por su preferencia', texto: (c) => `¡Gracias por su preferencia, ${c.nombre}! Para su próximo pedido escríbanos al 4237 2018. ${NEGOCIO}, agua pura, vida sana.` },
    'a-la-orden': { alt: 'Estamos a la orden', texto: (c, p, deuda) => deuda ? `Hola ${c.nombre}, le saluda ${NEGOCIO}. Le recordamos su saldo pendiente de ${Q(deuda)}. ¡Estamos a la orden! WhatsApp 4237 2018.` : `¡Estamos a la orden! Pedidos de agua pura ${NEGOCIO} al WhatsApp 4237 2018.` },
  };
  const da = $('#dlg-aviso');
  let aviso = null;
  $('#stickers').innerHTML = Object.entries(STICKERS).map(([k, v]) => `<button type="button" data-k="${k}" aria-label="${esc(v.alt)}"><img src="assets/stickers/${k}.webp" alt=""></button>`).join('');

  function abrirAviso(c, tipo, titulo, p, deuda) {
    aviso = { c, p, deuda };
    $('#aviso-titulo').textContent = titulo;
    $('#aviso-para').textContent = `Para ${c.nombre}${c.telefono ? ' · ' + c.telefono : ''}`;
    elegirSticker(tipo);
    da.showModal();
    return new Promise((ok) => da.addEventListener('close', ok, { once: true }));
  }
  function elegirSticker(k) {
    aviso.k = k;
    $('#aviso-sticker').src = `assets/stickers/${k}.webp`;
    $('#aviso-sticker').alt = STICKERS[k].alt;
    $$('#stickers button').forEach((b) => b.classList.toggle('on', b.dataset.k === k));
    $('#aviso-texto').value = STICKERS[k].texto(aviso.c, aviso.p, aviso.deuda);
    actualizarWhats();
  }
  function actualizarWhats() {
    const w = linkWhats(aviso.c, $('#aviso-texto').value);
    const a = $('#btn-whats');
    a.hidden = !w;
    if (w) a.href = w;
  }
  $('#stickers').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) elegirSticker(b.dataset.k); });
  $('#aviso-texto').addEventListener('input', actualizarWhats);
  $('#btn-cerrar-aviso').addEventListener('click', () => da.close());

  async function stickerComoPng(k) {
    const blob = await (await fetch(`assets/stickers/${k}.webp`)).blob();
    const bmp = await createImageBitmap(blob);
    const cv = document.createElement('canvas');
    cv.width = bmp.width; cv.height = bmp.height;
    const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(bmp, 0, 0);
    const png = await new Promise((ok) => cv.toBlob(ok, 'image/png'));
    return new File([png], `jabel-ya-${k}.png`, { type: 'image/png' });
  }
  $('#btn-compartir').addEventListener('click', async () => {
    const texto = $('#aviso-texto').value;
    try {
      const archivo = await stickerComoPng(aviso.k);
      if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
        await navigator.share({ files: [archivo], text: texto });
        return;
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return; // el usuario cerró el menú de compartir
    }
    const w = linkWhats(aviso.c, texto);
    if (w) { window.open(w, '_blank', 'noopener'); toast('Este celular no permite enviar la imagen; se envía solo el texto.'); }
    else toast('Este navegador no permite compartir imágenes. Usa Chrome en Android.');
  });

  /* ---------- Repartidor del pedido ---------- */
  function pintarSelectRepartidor(valor) {
    const lbl = $('#lbl-repartidor');
    const activos = usuarios.filter((u) => u.activo);
    lbl.hidden = !(conectado() && rol() === 'admin' && activos.length);
    if (lbl.hidden) { fp.repartidor.innerHTML = '<option value=""></option>'; return; }
    fp.repartidor.innerHTML = '<option value="">Sin asignar (solo lo ve el administrador)</option>' +
      activos.map((u) => `<option value="${esc(u.usuario)}">${esc(u.nombre)}${u.rol === 'admin' ? ' (administrador)' : ''}</option>`).join('');
    fp.repartidor.value = activos.some((u) => u.usuario === valor) ? valor : '';
  }

  /* ---------- Clientes frecuentes ---------- */
  const ultimoPedido = (c) => pedidos.filter((p) => p.clienteId === c.id).sort((a, b) => b.creado - a.creado)[0];
  function pintarFrecuentes() {
    const cuenta = {};
    pedidos.forEach((p) => { cuenta[p.clienteId] = (cuenta[p.clienteId] || 0) + 1; });
    const lista = clientes.filter((c) => c.frecuente || cuenta[c.id] >= 2)
      .sort((a, b) => (b.frecuente ? 1 : 0) - (a.frecuente ? 1 : 0) || (cuenta[b.id] || 0) - (cuenta[a.id] || 0))
      .slice(0, 20);
    const box = $('#frecuentes-box');
    box.hidden = !lista.length || !!fp.id.value;
    $('#frecuentes').innerHTML = lista.map((c) => {
      const u = ultimoPedido(c);
      return `<button type="button" data-id="${esc(c.id)}"><b>${c.frecuente ? '⭐ ' : ''}${esc(c.nombre)}</b>
        <span>${u ? `${esc(u.cantidad)} × ${esc(u.producto.replace(/ \(.*\)/, ''))} · ${Q(u.total)}` : 'Sin pedidos aún'}</span></button>`;
    }).join('');
  }
  $('#frecuentes').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) repetirPedido(clientes.find((c) => c.id === b.dataset.id));
  });

  async function repetirPedido(c) {
    if (!c) return;
    const u = ultimoPedido(c);
    if (!u) { mostrar('nuevo'); limpiarPedido(c); toast('Primer pedido de este cliente: llena los datos.'); return; }
    const p = {
      id: uid(), clienteId: c.id, producto: u.producto, cantidad: u.cantidad, precio: u.precio, total: u.cantidad * u.precio,
      notas: '', repartidor: usuarios.some((x) => x.usuario === u.repartidor && x.activo) ? u.repartidor : (ajustes.ultimoRepartidor || ''),
      estado: 'pendiente', creado: Date.now(), entregadoEn: null, pagado: false, pagadoEn: null,
    };
    pedidos.push(p);
    await guardarCambio('pedidos', p);
    refrescar();
    filtro = 'pendiente'; $$('#v-pedidos .seg button').forEach((x) => x.classList.toggle('on', x.dataset.filtro === 'pendiente'));
    mostrar('pedidos');
    toast(`Pedido repetido ✓ ${p.cantidad} × ${p.producto} para ${c.nombre}`);
    abrirAviso(c, 'con-gusto', 'Pedido repetido ✓', p);
  }

  /* ---------- Reportes ---------- */
  let repPeriodo = 'dia', repDesplaza = 0;
  const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  function rangoReporte(desp = repDesplaza) {
    const h = new Date(); h.setHours(0, 0, 0, 0);
    let ini, fin, titulo;
    if (repPeriodo === 'dia') {
      ini = new Date(h); ini.setDate(ini.getDate() + desp);
      fin = new Date(ini); fin.setDate(fin.getDate() + 1);
      titulo = desp === 0 ? 'Hoy' : desp === -1 ? 'Ayer' : ini.toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'short' });
    } else if (repPeriodo === 'semana') {
      ini = new Date(h); ini.setDate(ini.getDate() - ((ini.getDay() + 6) % 7) + desp * 7); // lunes
      fin = new Date(ini); fin.setDate(fin.getDate() + 7);
      const ult = new Date(fin); ult.setDate(ult.getDate() - 1);
      const f = (d) => d.toLocaleDateString('es-GT', { day: 'numeric', month: 'short' });
      titulo = desp === 0 ? `Esta semana (${f(ini)} – ${f(ult)})` : `${f(ini)} – ${f(ult)}`;
    } else {
      ini = new Date(h.getFullYear(), h.getMonth() + desp, 1);
      fin = new Date(ini.getFullYear(), ini.getMonth() + 1, 1);
      titulo = ini.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });
    }
    return { ini: +ini, fin: +fin, titulo };
  }
  $$('#rep-periodo button').forEach((b) => b.addEventListener('click', () => {
    repPeriodo = b.dataset.p; repDesplaza = 0;
    $$('#rep-periodo button').forEach((x) => x.classList.toggle('on', x === b));
    pintarReportes();
  }));
  $('#rep-ant').addEventListener('click', () => { repDesplaza--; pintarReportes(); });
  $('#rep-sig').addEventListener('click', () => { if (repDesplaza < 0) { repDesplaza++; pintarReportes(); } });

  function pintarReportes() {
    const { ini, fin, titulo } = rangoReporte();
    $('#rep-titulo').textContent = titulo;
    $('#rep-sig').disabled = repDesplaza >= 0;
    const ent = pedidos.filter((p) => p.estado === 'entregado' && p.entregadoEn >= ini && p.entregadoEn < fin);
    const suma = (l, k) => l.reduce((s, p) => s + (+p[k] || 0), 0);
    const cobrado = ent.filter((p) => p.pagado), fiado = ent.filter((p) => !p.pagado);
    const pendientes = pedidos.filter((p) => p.estado === 'pendiente').length;
    $('#rep-kpis').innerHTML = [
      ['Vendido', Q(suma(ent, 'total'))],
      ['Garrafones entregados', suma(ent, 'cantidad')],
      ['Cobrado', Q(suma(cobrado, 'total'))],
      ['Fiado en el periodo', Q(suma(fiado, 'total')), 'fiado'],
      ['Pedidos entregados', ent.length],
      ['Pendientes por entregar ahora', pendientes],
    ].map(([t, v, cl]) => `<div class="kpi ${cl || ''}"><b>${esc(v)}</b><span>${t}</span></div>`).join('');

    // Comparación con el periodo anterior
    const ant = rangoReporte(repDesplaza - 1);
    const entAnt = pedidos.filter((p) => p.estado === 'entregado' && p.entregadoEn >= ant.ini && p.entregadoEn < ant.fin);
    const cambio = (a, b) => (!b ? '' : `${a >= b ? '▲' : '▼'} ${Math.abs(Math.round((a - b) / b * 100))}%`);
    const nomAnt = { dia: 'día anterior', semana: 'semana anterior', mes: 'mes anterior' }[repPeriodo];
    $$('#rep-kpis .kpi').forEach((k, i) => {
      const comp = [[suma(ent, 'total'), suma(entAnt, 'total')], [suma(ent, 'cantidad'), suma(entAnt, 'cantidad')]][i];
      if (comp && cambio(...comp)) k.insertAdjacentHTML('beforeend', `<small class="${comp[0] >= comp[1] ? 'sube' : 'baja'}">${cambio(...comp)} vs ${nomAnt}</small>`);
    });

    const cubetas = (r) => {
      const et = [], val = [];
      if (repPeriodo === 'dia') {
        for (let hh = 5; hh <= 21; hh++) { et.push(`${hh}h`); val.push(0); }
      } else {
        for (let t = new Date(r.ini); +t < r.fin; t.setDate(t.getDate() + 1)) { et.push(repPeriodo === 'semana' ? `${DIAS[t.getDay()]} ${t.getDate()}` : String(t.getDate())); val.push(0); }
      }
      pedidos.forEach((p) => {
        if (p.estado !== 'entregado' || p.entregadoEn < r.ini || p.entregadoEn >= r.fin) return;
        const d = new Date(p.entregadoEn);
        const i = repPeriodo === 'dia' ? Math.min(21, Math.max(5, d.getHours())) - 5 : Math.round((new Date(d).setHours(0, 0, 0, 0) - r.ini) / 864e5);
        if (val[i] != null) val[i] += +p.cantidad;
      });
      return { et, val };
    };
    const act = cubetas({ ini, fin }), prev = cubetas(ant);
    const unidad = repPeriodo === 'dia' ? 'hora' : 'día';
    $('#g1-titulo').textContent = `Garrafones vendidos por ${unidad}`;
    const iMax = act.val.indexOf(Math.max(...act.val));
    $('#g1-nota').textContent = act.val[iMax] > 0
      ? `${repPeriodo === 'dia' ? 'La mejor hora fue' : 'El mejor día fue'} ${act.et[iMax]}: ${act.val[iMax]} garrafón(es).`
      : 'No hay entregas en este periodo.';
    columnas($('#g1'), act.et, [{ nombre: titulo, clase: 's1', valores: act.val }], { fmt: (v) => `${v} garrafón(es)`, titulo: 'Garrafones vendidos' });

    const etComp = repPeriodo === 'semana' ? ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'] : act.et;
    const prevVals = etComp.map((_, i) => prev.val[i] || 0);
    const tA = act.val.reduce((a, b) => a + b, 0), tP = prevVals.reduce((a, b) => a + b, 0);
    const nomAct = { dia: titulo === 'Hoy' ? 'Hoy' : 'Este día', semana: 'Esta semana', mes: 'Este mes' }[repPeriodo];
    $('#g2-titulo').textContent = `Comparado con ${repPeriodo === 'semana' ? 'la' : 'el'} ${nomAnt}`;
    $('#g2-leyenda').innerHTML = `<span><i class="s1"></i>${esc(nomAct)}: <b>${tA}</b> garrafones</span>
      <span><i class="s2"></i>${esc(nomAnt[0].toUpperCase() + nomAnt.slice(1))}: <b>${tP}</b>${cambio(tA, tP) ? ` · <b class="${tA >= tP ? 'sube' : 'baja'}">${cambio(tA, tP)}</b>` : ''}</span>`;
    columnas($('#g2'), etComp, [{ nombre: nomAct, clase: 's1', valores: act.val }, { nombre: nomAnt, clase: 's2', valores: prevVals }], { fmt: (v) => `${v} garrafón(es)`, marcarMejor: false, titulo: 'Comparación con el periodo anterior' });

    // ¿Qué día de la semana se vende más? (promedio de las últimas 8 semanas)
    const hoy0 = new Date(); hoy0.setHours(0, 0, 0, 0);
    const desde8 = +hoy0 - 55 * 864e5;
    const sumaDia = [0, 0, 0, 0, 0, 0, 0], veces = [0, 0, 0, 0, 0, 0, 0];
    for (let t = new Date(desde8); +t <= +hoy0; t.setDate(t.getDate() + 1)) veces[(t.getDay() + 6) % 7]++;
    pedidos.forEach((p) => { if (p.estado === 'entregado' && p.entregadoEn >= desde8) sumaDia[(new Date(p.entregadoEn).getDay() + 6) % 7] += +p.cantidad; });
    const prom = sumaDia.map((s, i) => Math.round(s / Math.max(1, veces[i]) * 10) / 10);
    const NOMBRES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];
    const iTop = prom.indexOf(Math.max(...prom));
    $('#g3-nota').textContent = prom[iTop] > 0
      ? `Los ${NOMBRES[iTop]} se vende más: ${prom[iTop]} garrafones en promedio (últimas 8 semanas).`
      : 'Todavía no hay ventas suficientes para comparar los días.';
    columnas($('#g3'), ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'], [{ nombre: 'Promedio', clase: 's1', valores: prom }], { fmt: (v) => `${v} garrafones en promedio`, titulo: 'Promedio por día de la semana' });

    // Tablas
    const agrupar = (clave) => {
      const o = {};
      ent.forEach((p) => { const k = clave(p); (o[k] ||= { n: 0, cant: 0, total: 0 }); o[k].n++; o[k].cant += +p.cantidad; o[k].total += +p.total; });
      return Object.entries(o).sort((a, b) => b[1].total - a[1].total);
    };
    const tabla = (filas, col) => filas.length
      ? `<tr><th>${col}</th><th class="n">Cant.</th><th class="n">Total</th></tr>` + filas.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">${v.cant}</td><td class="n">${Q(v.total)}</td></tr>`).join('')
      : '<tr><td class="hint">Sin datos</td></tr>';
    $('#rep-productos').innerHTML = tabla(agrupar((p) => p.producto), 'Producto');
    $('#rep-repartidores').innerHTML = tabla(agrupar((p) => (p.repartidor ? nombreUsuario(p.repartidor) : 'Sin asignar')), 'Repartidor');

    // Cobros pendientes (de todas las fechas)
    const deudas = {};
    pedidos.filter((p) => p.estado === 'entregado' && !p.pagado).forEach((p) => {
      const d = (deudas[p.clienteId] ||= { lista: [], cant: 0, total: 0, desde: p.entregadoEn });
      d.lista.push(p); d.cant += +p.cantidad; d.total += +p.total; d.desde = Math.min(d.desde, p.entregadoEn);
    });
    const filas = Object.entries(deudas).sort((a, b) => b[1].total - a[1].total);
    const totalFiado = filas.reduce((s, [, d]) => s + d.total, 0);
    const garrFiados = filas.reduce((s, [, d]) => s + d.cant, 0);
    $('#rep-fiado-total').innerHTML = filas.length
      ? `Total por cobrar: <b>${Q(totalFiado)}</b> · <b>${garrFiados}</b> garrafón(es) fiado(s) · ${filas.length} cliente(s)`
      : 'Nadie debe nada. ¡Todo cobrado! ✓';
    $('#rep-fiados').innerHTML = filas.map(([id, d]) => {
      const c = clientePor(id);
      return `<li class="item fiado" data-id="${esc(id)}">
        <div class="cab"><h3>${esc(c.nombre)}</h3><span class="precio">${Q(d.total)}</span></div>
        <div class="meta">${d.cant} garrafón(es) fiado(s) en ${d.lista.length} pedido(s) · desde ${fecha(d.desde)}</div>
        <div class="acciones">
          <button class="btn ok chico" data-r="cobrar">💵 Cobrar todo</button>
          ${c.telefono ? `<a class="btn chico" href="tel:${esc(telLimpio(c.telefono))}">Llamar</a>` : ''}
          <button class="btn chico" data-r="recordar">Recordar por WhatsApp</button>
        </div></li>`;
    }).join('');
  }
  $('#rep-fiados').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-r]');
    if (!b) return;
    const id = b.closest('.item').dataset.id;
    const c = clientePor(id);
    const lista = pedidos.filter((p) => p.clienteId === id && p.estado === 'entregado' && !p.pagado);
    const total = lista.reduce((s, p) => s + p.total, 0);
    if (b.dataset.r === 'recordar') return abrirAviso(c, 'a-la-orden', 'Recordar cobro', null, total);
    if (await confirmar(`¿${c.nombre} pagó ${Q(total)}? Se marcan ${lista.length} pedido(s) como pagados.`)) {
      const ahora = Date.now();
      for (const p of lista) { p.pagado = true; p.pagadoEn = ahora; await guardarCambio('pedidos', p); }
      refrescar(); toast(`Cobrado ${Q(total)} ✓`);
    }
  });

  /* ---------- Repartidor: GPS, siguiente entrega y ruta ---------- */
  function distanciaKm(a, b) {
    const r = Math.PI / 180, R = 6371;
    const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const textoDist = (km) => (km < 1 ? `${Math.round(km * 1000 / 10) * 10} m` : `${km.toFixed(1)} km`);
  const distA = (c) => (miPos && c && c.lat ? distanciaKm(miPos, c) : null);

  // Casas pendientes ordenadas por la ruta más corta (la más cercana primero, luego la más cercana a esa…)
  function rutaPendiente() {
    const pend = {};
    pedidos.filter((p) => p.estado === 'pendiente').forEach((p) => { (pend[p.clienteId] ||= []).push(p); });
    let casas = Object.keys(pend).map((id) => ({ c: clientePor(id), lista: pend[id] })).filter((x) => x.c.lat);
    const orden = [];
    let desde = miPos;
    while (casas.length) {
      let i = 0;
      if (desde) casas.forEach((x, j) => { if (distanciaKm(desde, x.c) < distanciaKm(desde, casas[i].c)) i = j; });
      const x = casas.splice(i, 1)[0];
      orden.push(x); desde = x.c;
    }
    return orden;
  }

  function pintarSiguiente() {
    const box = $('#siguiente');
    if (MODO !== 'pedidos') { box.hidden = true; return; }
    const ruta = rutaPendiente();
    const sinGps = new Set(pedidos.filter((p) => p.estado === 'pendiente' && !clientePor(p.clienteId).lat).map((p) => p.clienteId)).size;
    if (!ruta.length) {
      box.hidden = false;
      box.innerHTML = `<b>${sinGps ? `${sinGps} entrega(s) sin punto GPS` : 'No hay entregas pendientes ✓'}</b>
        <p class="hint">${sinGps ? 'Búscalas en “Pedidos” y guarda el GPS al llegar.' : '¡Buen trabajo!'}</p>`;
      return;
    }
    const { c, lista } = ruta[0];
    const cant = lista.reduce((s, p) => s + p.cantidad, 0);
    const total = lista.reduce((s, p) => s + p.total, 0);
    const d = distA(c);
    const paradas = ruta.slice(0, 10).map((x) => `${x.c.lat},${x.c.lng}`);
    const rutaUrl = `https://www.google.com/maps/dir/?api=1${miPos ? `&origin=${miPos.lat},${miPos.lng}` : ''}&destination=${paradas[paradas.length - 1]}${paradas.length > 1 ? `&waypoints=${encodeURIComponent(paradas.slice(0, -1).join('|'))}` : ''}&travelmode=driving`;
    box.hidden = false;
    box.innerHTML = `<div class="cab"><span class="hint">Siguiente entrega${d != null ? ` · a ${textoDist(d)}` : ''}</span><span class="hint">${ruta.length} parada(s)</span></div>
      <h3>${esc(c.nombre)}</h3>
      <div><b>${cant} garrafón(es)</b> · cobrar <b>${Q(total)}</b></div>
      ${c.referencia || c.direccion ? `<div class="meta">${esc([c.direccion, c.referencia].filter(Boolean).join(' · '))}</div>` : ''}
      <div class="acciones">
        <a class="btn primario" href="${esc(linkRuta(c))}" target="_blank" rel="noopener">🧭 Cómo llegar</a>
        <button class="btn ok" data-s="entregar">✓ Entregado</button>
        ${c.telefono ? `<a class="btn chico" href="tel:${esc(telLimpio(c.telefono))}">Llamar</a>` : ''}
        <button class="btn chico" data-s="avisar">Avisar</button>
        ${ruta.length > 1 ? `<a class="btn chico" href="${esc(rutaUrl)}" target="_blank" rel="noopener">Ruta completa</a>` : ''}
      </div>`;
    box.onclick = (e) => {
      const b = e.target.closest('[data-s]');
      if (!b) return;
      if (b.dataset.s === 'entregar') entregar(lista);
      if (b.dataset.s === 'avisar') abrirAviso(c, 'en-camino', 'Avisar al cliente', lista[0]);
    };
  }

  /* ---------- Gráficas (dueño) ---------- */
  const tip = $('#tip');
  function mostrarTip(e) {
    const t = e.target.closest('[data-tip]');
    if (!t) { tip.hidden = true; return; }
    tip.textContent = t.dataset.tip; tip.hidden = false;
    const x = Math.min(innerWidth - tip.offsetWidth - 8, Math.max(8, e.clientX - tip.offsetWidth / 2));
    tip.style.left = x + 'px'; tip.style.top = Math.max(8, e.clientY - tip.offsetHeight - 14) + 'px';
  }
  document.addEventListener('pointermove', (e) => { if (e.target.closest('.fig')) mostrarTip(e); else tip.hidden = true; });
  document.addEventListener('click', (e) => { if (e.target.closest('.fig')) mostrarTip(e); });

  // Columnas verticales. series: [{ nombre, clase, valores }], etiquetas: textos del eje X
  const graficas = new Map();
  function columnas(el, etiquetas, series, opc = {}) {
    graficas.set(el, { etiquetas, series, opc });
    if (!el._ro) { el._ro = new ResizeObserver(() => dibujar(el)); el._ro.observe(el); }
    dibujar(el);
  }
  function dibujar(el) {
    const g = graficas.get(el);
    if (!g || !el.clientWidth) return;
    const { etiquetas, series, opc } = g;
    const W = el.clientWidth, H = el.clientHeight || 220;
    const izq = 34, der = 8, arr = 18, aba = 26;
    const n = etiquetas.length, ns = series.length;
    const max = Math.max(1, ...series.flatMap((s) => s.valores));
    const paso = Math.pow(10, Math.floor(Math.log10(max)));
    const tope = Math.ceil(max / paso) * paso;
    const y = (v) => arr + (H - arr - aba) * (1 - v / tope);
    const banda = (W - izq - der) / n;
    const ancho = Math.max(2, Math.min(28, (banda * 0.7 - (ns - 1) * 2) / ns));
    const cada = Math.ceil(n / Math.max(1, Math.floor((W - izq) / 34)));
    let svg = '';
    [0, tope / 2, tope].filter((v) => Number.isInteger(v)).forEach((v) => {
      svg += `<line x1="${izq}" x2="${W - der}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${izq - 6}" y="${y(v) + 4}" class="eje" text-anchor="end">${Math.round(v)}</text>`;
    });
    let mejor = -1, mejorV = -1;
    series[0].valores.forEach((v, i) => { if (v > mejorV) { mejorV = v; mejor = i; } });
    etiquetas.forEach((et, i) => {
      const x0 = izq + banda * i + (banda - (ancho * ns + (ns - 1) * 2)) / 2;
      series.forEach((s, k) => {
        const v = s.valores[i] || 0;
        const x = x0 + k * (ancho + 2), yt = y(v), h = H - aba - yt;
        const r = Math.min(4, ancho / 2, h);
        const d = h > 0 ? `M${x},${H - aba} V${yt + r} Q${x},${yt} ${x + r},${yt} H${x + ancho - r} Q${x + ancho},${yt} ${x + ancho},${yt + r} V${H - aba} Z` : '';
        const hint = `${et}: ${opc.fmt ? opc.fmt(v) : v}${ns > 1 ? ` (${s.nombre})` : ''}`;
        svg += `<g data-tip="${esc(hint)}"><rect x="${izq + banda * i}" y="${arr}" width="${banda}" height="${H - arr - aba}" fill="transparent"/>${d ? `<path d="${d}" class="${s.clase}"/>` : ''}</g>`;
      });
      if (i % cada === 0 || i === mejor) svg += `<text x="${izq + banda * i + banda / 2}" y="${H - 8}" class="eje${i === mejor && mejorV > 0 ? ' fuerte' : ''}" text-anchor="middle">${esc(et)}</text>`;
    });
    if (mejorV > 0 && opc.marcarMejor !== false) {
      const xm = izq + banda * mejor + banda / 2;
      const txt = opc.fmt ? opc.fmt(mejorV) : mejorV;
      svg += `<text x="${Math.min(W - der - 4, Math.max(izq + 14, xm))}" y="${y(mejorV) - 5}" class="valor" text-anchor="middle">${esc(txt)}</text>`;
    }
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(opc.titulo || '')}">${svg}</svg>`;
  }

  /* ---------- Datos de ejemplo (para probar) ---------- */
  async function cargarEjemplo() {
    const ej = [
      ['María López', '5512 3344', 'Zona 1', '4a avenida 10-25', 'Portón verde', 14.6420, -90.5135, 2],
      ['Don Carlos Pérez', '4455 6677', 'Zona 5', '12 calle 3-40', 'Frente a la tienda La Bendición', 14.6255, -90.4990, 3],
      ['Tienda Doña Rosa', '3322 1100', 'Zona 6', '15 avenida 8-12', 'Esquina, rótulo azul', 14.6480, -90.4905, 6],
      ['Ana Morales', '', 'Zona 3', '2a calle 5-60', 'Casa de dos niveles', null, null, 1],
    ];
    const t = Date.now();
    ej.forEach(([nombre, telefono, zona, direccion, referencia, lat, lng, cant], i) => {
      const c = { id: uid(), nombre, telefono, zona, direccion, referencia, fotos: [], creado: t };
      if (lat) Object.assign(c, { lat, lng });
      clientes.push(c);
      pedidos.push({ id: uid(), clienteId: c.id, producto: 'Garrafón 5 gal (recarga)', cantidad: cant, precio: ajustes.precio, total: cant * ajustes.precio, notas: i === 1 ? 'Llamar antes de llegar' : '', estado: 'pendiente', creado: t - (4 - i) * 600000, entregadoEn: null });
    });
    for (const c of clientes) await guardarCambio('clientes', c);
    for (const p of pedidos) await guardarCambio('pedidos', p);
    refrescar(); toast('Datos de ejemplo cargados');
  }

  /* ---------- Arranque ---------- */
  function refrescar() {
    pintarStats(); pintarPedidos(); pintarClientes(); pintarMapa(false); pintarSync();
    if (!$('#v-reportes').hidden || !$('#v-cobros').hidden) pintarReportes();
    if (!$('#v-mapa').hidden) pintarSiguiente();
    if (!$('#v-nuevo').hidden) pintarFrecuentes();
  }
  async function cargar() {
    clientes = await DB.todos('clientes');
    pedidos = await DB.todos('pedidos');
    refrescar();
  }
  aplicarRol();
  if (!conectado() && !modoLocal) mostrar('entrar'); else mostrar(INICIO);
  cargar().then(() => { if (DB.modoMemoria) toast('Este navegador no guarda datos: usa Chrome en el celular.'); sincronizar(); });
  setInterval(() => { if (document.visibilityState === 'visible') sincronizar(); }, 60000);
  addEventListener('online', () => sincronizar());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sincronizar(); });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo sin conexión */ });
  }
}
