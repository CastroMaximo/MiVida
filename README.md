# MiVida

Agenda, notas, dinero y estudio en una sola app web instalable. Funciona en la computadora y en el iPhone, sin servidor propio.

## Qué hace

- **Buscador inteligente.** Escribe `Parcial Física 15 nov 14:00`, `Entrega TP Redes viernes 23:59`, `gasto 4500 almuerzo` o `nota ideas para la expo` y la app arma el registro con tipo, materia, fecha, ámbito y avisos. `#personal`, `#trabajo`, etc. fuerzan el ámbito.
- **Agenda** en lista o por mes, con ámbitos de color (Universidad, Personal, Trabajo, Salud, Finanzas, Hogar; se editan en Ajustes).
- **Notas** con búsqueda, ámbito y fijadas.
- **Dinero.** Gastos fijos que reaparecen cada mes y se tildan al pagar (se anotan solos como gasto), movimientos, balance, presupuesto y gastos por categoría.
- **Estudio.** Temporizador con formatos propios (25/5, 50/10, los que crees) y registro de horas por día, mes y materia.
- **Bloqueo** con PIN en cualquier equipo y Face ID / huella donde el dispositivo lo ofrece.
- **Google (opcional).** Envía cada fecha a Google Calendar con sus alertas, muestra tus otros eventos y sincroniza la PC con el iPhone mediante una copia privada en tu Drive.

## Publicarla (GitHub Pages)

1. Sube el contenido de esta carpeta a la rama `main` del repositorio (`CastroMaximo/MiVida`).
2. En el repositorio: **Settings → Pages → Deploy from a branch → main / (root)**.
3. A los pocos minutos queda en `https://castromaximo.github.io/MiVida/`.

El repositorio solo contiene el código. Tus datos nunca se suben a GitHub: viven en el navegador de cada dispositivo y, si conectas Google, en tu Drive.

## Instalarla

- **iPhone:** abre la dirección en Safari → Compartir → **Agregar a inicio**. Ábrela desde el ícono: ahí funcionan Face ID y las notificaciones (iOS 16.4 o posterior).
- **Computadora:** en Chrome o Edge, ícono de instalar en la barra de direcciones. También se puede usar en una pestaña.

La primera vez pide crear un PIN en cada dispositivo.

## Conectar Google (una sola vez, unos 10 minutos)

1. Entra a <https://console.cloud.google.com>, crea un proyecto y activa **Google Calendar API** y **Google Drive API**.
2. En **Pantalla de consentimiento de OAuth** elige **Externa**, déjala en modo de prueba y agrégate como **usuario de prueba**.
3. En **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web** agrega:
   - Origen de JavaScript autorizado: `https://castromaximo.github.io`
   - URI de redireccionamiento autorizado: `https://castromaximo.github.io/MiVida/` (respeta mayúsculas y la barra final)
   (Ajustes → Google muestra la dirección exacta para copiar.)
4. Copia el **ID de cliente** y pégalo en `config.js` (así lo toman todos tus dispositivos) o en Ajustes → Google de cada uno.
5. En la app: Ajustes → Google → **Conectar**.

Sin este paso la app funciona igual en cada dispositivo por separado, y cada pendiente trae un enlace "Añadir a Google Calendar".

## Límites que conviene conocer

- **Permiso de Google de 1 hora.** Google no entrega permisos permanentes a apps sin servidor. La app lo renueva sola: al abrirla con el permiso vencido va a Google sin mostrar pantallas y vuelve en un instante, antes de pedir el PIN. Si Google exige que intervengas (por ejemplo, cerraste tu sesión de Google en ese navegador, o pasaron 7 días con el proyecto en modo de prueba), aparece el aviso "Reconectar". Se puede apagar en Ajustes → Google → Reconexión automática.
- **Notificaciones.** Las de la app suenan con la app abierta o recién minimizada. Con la app cerrada, el aviso llega por la alerta del evento en Google Calendar. Avisos push con la app cerrada requieren un servidor.
- **Bloqueo.** El PIN y Face ID impiden abrir la app; no cifran los datos guardados en el navegador del dispositivo.
- **Copia de seguridad.** Ajustes → Tus datos → Exportar descarga un archivo con todo.

## Estructura

```
index.html            estructura de la página
config.js             ID de cliente de Google (opcional)
css/app.css           estilos (tema claro y oscuro)
js/app.js             pantallas y acciones
js/store.js           datos, guardado local y fusión entre dispositivos
js/parser.js          buscador inteligente (texto → registro)
js/lock.js            PIN y Face ID
js/google.js          Drive, Calendar y sincronización
js/notify.js          avisos
js/timer.js           sesiones de estudio
js/demo.js            datos de ejemplo (solo con ?demo)
sw.js                 uso sin conexión
```

No hay paso de compilación: son archivos estáticos. Para probar en tu equipo: `python3 -m http.server` dentro de la carpeta y abre `http://localhost:8000`. Con `?demo` al final se ve con datos de ejemplo y sin bloqueo.
