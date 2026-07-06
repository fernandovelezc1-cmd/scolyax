/**
 * Stickers — set de iconos/stickers SVG modernos (duotono) que reemplazan
 * a los emojis. Usan currentColor (lima en oscuro, negro en claro) para el
 * trazo y un relleno tenue del mismo color para el efecto duotono.
 *
 * Uso: <Sticker name="flow" size={48} />
 */
import React from 'react'

const PATHS = {
  // Sol (saludo día)
  sun: (
    <>
      <circle cx="24" cy="24" r="8" fill="currentColor" fillOpacity=".18" />
      <circle cx="24" cy="24" r="8" />
      <path d="M24 4v4M24 40v4M4 24h4M40 24h4M9.9 9.9l2.8 2.8M35.3 35.3l2.8 2.8M38.1 9.9l-2.8 2.8M12.7 35.3l-2.8 2.8" />
    </>
  ),
  // Luna (noche)
  moon: (
    <>
      <path d="M30 6a14 14 0 1 0 12 21A11 11 0 0 1 30 6Z" fill="currentColor" fillOpacity=".18" />
      <path d="M30 6a14 14 0 1 0 12 21A11 11 0 0 1 30 6Z" />
    </>
  ),
  // Tablero / tareas
  tasks: (
    <>
      <rect x="6" y="8" width="36" height="32" rx="5" fill="currentColor" fillOpacity=".14" />
      <rect x="6" y="8" width="36" height="32" rx="5" />
      <path d="M13 18h8M13 24h8M13 30h5" />
      <path d="M28 23l3 3 6-6" />
    </>
  ),
  // Campana / recordatorios
  bell: (
    <>
      <path d="M12 20a12 12 0 0 1 24 0c0 9 4 11 4 11H8s4-2 4-11Z" fill="currentColor" fillOpacity=".16" />
      <path d="M12 20a12 12 0 0 1 24 0c0 9 4 11 4 11H8s4-2 4-11Z" />
      <path d="M20 37a4 4 0 0 0 8 0" />
    </>
  ),
  // Calendario
  calendar: (
    <>
      <rect x="7" y="10" width="34" height="32" rx="5" fill="currentColor" fillOpacity=".14" />
      <rect x="7" y="10" width="34" height="32" rx="5" />
      <path d="M7 19h34M16 6v8M32 6v8" />
      <circle cx="17" cy="29" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="24" cy="29" r="2.2" fill="currentColor" stroke="none" />
    </>
  ),
  // Study Flow (libro/ondas)
  flow: (
    <>
      <path d="M8 11a5 5 0 0 1 5-5h11v34H13a5 5 0 0 0-5 5Z" fill="currentColor" fillOpacity=".16" />
      <path d="M8 11a5 5 0 0 1 5-5h11v34H13a5 5 0 0 0-5 5Z" />
      <path d="M40 11a5 5 0 0 0-5-5H24v34h11a5 5 0 0 1 5 5Z" />
    </>
  ),
  // Iris / chispa (IA)
  spark: (
    <>
      <path d="M24 5l3.4 11.6L39 20l-11.6 3.4L24 35l-3.4-11.6L9 20l11.6-3.4Z" fill="currentColor" fillOpacity=".18" />
      <path d="M24 5l3.4 11.6L39 20l-11.6 3.4L24 35l-3.4-11.6L9 20l11.6-3.4Z" />
      <path d="M37 32l1.4 3.6L42 37l-3.6 1.4L37 42l-1.4-3.6L32 37l3.6-1.4Z" />
    </>
  ),
  // Trofeo / logros
  trophy: (
    <>
      <path d="M14 8h20v10a10 10 0 0 1-20 0Z" fill="currentColor" fillOpacity=".16" />
      <path d="M14 8h20v10a10 10 0 0 1-20 0Z" />
      <path d="M14 10H8v3a7 7 0 0 0 7 7M34 10h6v3a7 7 0 0 1-7 7" />
      <path d="M19 40h10M24 28v12" />
    </>
  ),
  // Llama / racha
  flame: (
    <>
      <path d="M24 4c5 7-3 9-3 15a8 8 0 0 0 16 0c0-2-1-4-2-6 4 3 6 7 6 12a15 15 0 1 1-30 0C11 26 24 22 24 4Z" fill="currentColor" fillOpacity=".18" />
      <path d="M24 4c5 7-3 9-3 15a8 8 0 0 0 16 0c0-2-1-4-2-6 4 3 6 7 6 12a15 15 0 1 1-30 0C11 26 24 22 24 4Z" />
    </>
  ),
  // Bombilla / tip
  bulb: (
    <>
      <path d="M24 6a13 13 0 0 0-8 23v5h16v-5a13 13 0 0 0-8-23Z" fill="currentColor" fillOpacity=".16" />
      <path d="M24 6a13 13 0 0 0-8 23v5h16v-5a13 13 0 0 0-8-23Z" />
      <path d="M19 40h10M21 44h6" />
    </>
  ),
  // Rayo / estudiar ahora
  bolt: (
    <>
      <path d="M26 4 10 26h11l-3 18 18-24H24Z" fill="currentColor" fillOpacity=".18" />
      <path d="M26 4 10 26h11l-3 18 18-24H24Z" />
    </>
  ),
  // Más / nueva
  plus: (<path d="M24 10v28M10 24h28" />),
  // Documento / resúmenes
  doc: (
    <>
      <path d="M13 5h14l8 8v30H13Z" fill="currentColor" fillOpacity=".14" />
      <path d="M13 5h14l8 8v30H13Z" /><path d="M27 5v8h8" />
      <path d="M18 24h12M18 30h12M18 36h7" />
    </>
  ),
  // Lápiz / generar contenido
  write: (
    <>
      <path d="M30 8l10 10-22 22H8v-10Z" fill="currentColor" fillOpacity=".14" />
      <path d="M30 8l10 10-22 22H8v-10Z" /><path d="M26 12l10 10" />
    </>
  ),
  // Lupa / investigación
  research: (
    <>
      <circle cx="21" cy="21" r="13" fill="currentColor" fillOpacity=".14" />
      <circle cx="21" cy="21" r="13" /><path d="M31 31l10 10" />
    </>
  ),
  // Burbuja con ? / Q&A
  qa: (
    <>
      <path d="M8 12a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H20l-9 8v-8a4 4 0 0 1-3-4Z" fill="currentColor" fillOpacity=".14" />
      <path d="M8 12a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H20l-9 8v-8" />
      <path d="M20 17a4 4 0 1 1 5 4c-1 .7-1 1.5-1 2.5" /><path d="M24 28v.5" />
    </>
  ),
  // Mente / sentimiento
  mind: (
    <>
      <path d="M30 8a12 12 0 0 1 4 23v9h-13v-6a12 12 0 0 1 9-26Z" fill="currentColor" fillOpacity=".14" />
      <path d="M30 8a12 12 0 0 1 4 23v9h-13v-6a12 12 0 0 1 9-26Z" />
      <path d="M21 24c2-3 6-3 8 0" />
    </>
  ),
  // Carpeta / categorizar
  folder: (
    <>
      <path d="M6 12a3 3 0 0 1 3-3h9l4 5h15a3 3 0 0 1 3 3v17a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3Z" fill="currentColor" fillOpacity=".14" />
      <path d="M6 12a3 3 0 0 1 3-3h9l4 5h15a3 3 0 0 1 3 3v17a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3Z" />
    </>
  ),
  // Etiqueta / entidades
  tag: (
    <>
      <path d="M6 6h16l20 20-16 16L6 22Z" fill="currentColor" fillOpacity=".14" />
      <path d="M6 6h16l20 20-16 16L6 22Z" /><circle cx="15" cy="15" r="2.4" fill="currentColor" stroke="none" />
    </>
  ),
  // Micrófono / voz
  mic: (
    <>
      <rect x="18" y="5" width="12" height="22" rx="6" fill="currentColor" fillOpacity=".16" />
      <rect x="18" y="5" width="12" height="22" rx="6" />
      <path d="M12 22a12 12 0 0 0 24 0M24 34v8M17 42h14" />
    </>
  ),
  // Robot (cabeza) — usado como icono de sección IA
  robot: (
    <>
      <rect x="10" y="16" width="28" height="22" rx="7" fill="currentColor" fillOpacity=".16" />
      <rect x="10" y="16" width="28" height="22" rx="7" />
      <path d="M24 8v8M24 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
      <circle cx="19" cy="27" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="29" cy="27" r="2.4" fill="currentColor" stroke="none" />
      <path d="M4 26v6M44 26v6" />
    </>
  ),
  // Casa / inicio
  home: (
    <>
      <path d="M11 19v20h26V19" fill="currentColor" fillOpacity=".14" />
      <path d="M6 22 24 7l18 15" />
      <path d="M11 19v20h26V19" />
      <path d="M20 39V28h8v11" />
    </>
  ),
  // Check en círculo / tareas hechas
  check: (
    <>
      <circle cx="24" cy="24" r="18" fill="currentColor" fillOpacity=".14" />
      <circle cx="24" cy="24" r="18" />
      <path d="M16 24l6 6 11-12" />
    </>
  ),
  // Reloj despertador / recordatorios
  clock: (
    <>
      <circle cx="24" cy="26" r="15" fill="currentColor" fillOpacity=".14" />
      <circle cx="24" cy="26" r="15" />
      <path d="M24 18v8l6 4" />
      <path d="M9 9 4 14M39 9l5 5" />
    </>
  ),
  // Salvavidas / SOS-crisis
  sos: (
    <>
      <circle cx="24" cy="24" r="18" fill="currentColor" fillOpacity=".14" />
      <circle cx="24" cy="24" r="18" />
      <circle cx="24" cy="24" r="7" />
      <path d="M24 6v6M24 36v6M6 24h6M36 24h6M11.5 11.5l4.3 4.3M32.2 32.2l4.3 4.3M36.5 11.5l-4.3 4.3M15.8 32.2l-4.3 4.3" />
    </>
  ),
  // Diana / objetivos
  target: (
    <>
      <circle cx="24" cy="24" r="18" fill="currentColor" fillOpacity=".10" />
      <circle cx="24" cy="24" r="18" />
      <circle cx="24" cy="24" r="11" />
      <circle cx="24" cy="24" r="4" fill="currentColor" stroke="none" />
    </>
  ),
  // Batería / energía
  battery: (
    <>
      <rect x="5" y="15" width="33" height="18" rx="4" fill="currentColor" fillOpacity=".14" />
      <rect x="5" y="15" width="33" height="18" rx="4" />
      <path d="M42 21v6" />
      <path d="M23 18l-5 8h5l-2 6 7-9h-5Z" fill="currentColor" stroke="none" />
    </>
  ),
  // Brújula / test VARK
  compass: (
    <>
      <circle cx="24" cy="24" r="18" fill="currentColor" fillOpacity=".12" />
      <circle cx="24" cy="24" r="18" />
      <path d="M31 17l-4 10-10 4 4-10Z" fill="currentColor" stroke="none" />
      <path d="M31 17l-4 10-10 4 4-10Z" />
    </>
  ),
  // Birrete / IA académica
  cap: (
    <>
      <path d="M4 18 24 9l20 9-20 9Z" fill="currentColor" fillOpacity=".16" />
      <path d="M4 18 24 9l20 9-20 9Z" />
      <path d="M14 22v9c0 2 4 4 10 4s10-2 10-4v-9" />
      <path d="M44 18v10" />
    </>
  ),
  // Ondas / flowtime
  wave: (
    <>
      <path d="M4 18c4-4 8-4 12 0s8 4 12 0 8-4 12 0" />
      <path d="M4 26c4-4 8-4 12 0s8 4 12 0 8-4 12 0" />
      <path d="M4 34c4-4 8-4 12 0s8 4 12 0 8-4 12 0" />
    </>
  ),
  // Tomate / Pomodoro
  tomato: (
    <>
      <circle cx="24" cy="28" r="14" fill="currentColor" fillOpacity=".16" />
      <path d="M24 13c-3-4-8-5-11-3 2-3 8-4 11-1 3-3 9-2 11 1-3-2-8-1-11 3Z" fill="currentColor" stroke="none" />
      <circle cx="24" cy="28" r="14" />
      <path d="M24 15v3" />
    </>
  ),
  // Medalla / podio
  medal: (
    <>
      <path d="M16 5l8 13M32 5l-8 13" />
      <circle cx="24" cy="31" r="11" fill="currentColor" fillOpacity=".16" />
      <circle cx="24" cy="31" r="11" />
      <path d="M24 26l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6Z" fill="currentColor" stroke="none" />
    </>
  ),
  // Cohete / empezar
  rocket: (
    <>
      <path d="M24 4c7 4 11 12 11 21l-5 5H18l-5-5c0-9 4-17 11-21Z" fill="currentColor" fillOpacity=".16" />
      <path d="M24 4c7 4 11 12 11 21l-5 5H18l-5-5c0-9 4-17 11-21Z" />
      <circle cx="24" cy="20" r="4" fill="currentColor" stroke="none" />
      <path d="M18 33l-5 9 8-3M30 33l5 9-8-3" />
    </>
  ),
  // Corazón / apoyo (crisis)
  heart: (
    <>
      <path d="M24 40S6 28 6 16a9 9 0 0 1 18-3 9 9 0 0 1 18 3c0 12-18 24-18 24Z" fill="currentColor" fillOpacity=".16" />
      <path d="M24 40S6 28 6 16a9 9 0 0 1 18-3 9 9 0 0 1 18 3c0 12-18 24-18 24Z" />
    </>
  ),
  // Pin / ubicación
  pin: (
    <>
      <path d="M24 4a14 14 0 0 1 14 14c0 10-14 26-14 26S10 28 10 18A14 14 0 0 1 24 4Z" fill="currentColor" fillOpacity=".16" />
      <path d="M24 4a14 14 0 0 1 14 14c0 10-14 26-14 26S10 28 10 18A14 14 0 0 1 24 4Z" />
      <circle cx="24" cy="18" r="5" />
    </>
  ),
  // Repetir / revisar (flechas circulares)
  repeat: (
    <>
      <circle cx="24" cy="24" r="16" fill="currentColor" fillOpacity=".12" />
      <path d="M12 18a14 14 0 0 1 24-3l4 1M36 30a14 14 0 0 1-24 3l-4-1" />
      <path d="M36 9v7h-7M12 39v-7h7" />
    </>
  ),
  // Escudo / anti-distracción
  shield: (
    <>
      <path d="M24 5l15 6v9c0 11-7 18-15 23-8-5-15-12-15-23v-9Z" fill="currentColor" fillOpacity=".14" />
      <path d="M24 5l15 6v9c0 11-7 18-15 23-8-5-15-12-15-23v-9Z" />
      <path d="M17 23l5 5 9-10" />
    </>
  ),
  // Alerta / advertencia
  alert: (
    <>
      <path d="M24 6 44 40H4Z" fill="currentColor" fillOpacity=".14" />
      <path d="M24 6 44 40H4Z" />
      <path d="M24 18v10M24 34v.4" />
    </>
  ),
  // Pausa
  pause: (
    <>
      <rect x="13" y="9" width="8" height="30" rx="3" fill="currentColor" fillOpacity=".2" />
      <rect x="13" y="9" width="8" height="30" rx="3" />
      <rect x="27" y="9" width="8" height="30" rx="3" fill="currentColor" fillOpacity=".2" />
      <rect x="27" y="9" width="8" height="30" rx="3" />
    </>
  ),
  // Play / reanudar
  play: (
    <>
      <path d="M14 8l24 16-24 16Z" fill="currentColor" fillOpacity=".2" />
      <path d="M14 8l24 16-24 16Z" />
    </>
  ),
  // Stop / detener
  stop: (
    <>
      <rect x="10" y="10" width="28" height="28" rx="6" fill="currentColor" fillOpacity=".2" />
      <rect x="10" y="10" width="28" height="28" rx="6" />
    </>
  ),
  // Claqueta / streaming
  film: (
    <>
      <rect x="5" y="18" width="38" height="24" rx="4" fill="currentColor" fillOpacity=".14" />
      <rect x="5" y="18" width="38" height="24" rx="4" />
      <path d="M5 18 9 9l9 3 9-3 9 3-3 6" />
      <path d="M9 9l5 9M18 12l5 9M27 9l5 9" />
    </>
  ),
  // Monitor / video
  tv: (
    <>
      <rect x="5" y="9" width="38" height="26" rx="4" fill="currentColor" fillOpacity=".14" />
      <rect x="5" y="9" width="38" height="26" rx="4" />
      <path d="M21 17l8 5-8 5Z" fill="currentColor" stroke="none" />
      <path d="M16 42h16" />
    </>
  ),
  // Mando / juegos
  game: (
    <>
      <path d="M16 15h16a11 11 0 0 1 11 11 6 6 0 0 1-11 3.4l-1.6-2H17.6l-1.6 2A6 6 0 0 1 5 26a11 11 0 0 1 11-11Z" fill="currentColor" fillOpacity=".14" />
      <path d="M16 15h16a11 11 0 0 1 11 11 6 6 0 0 1-11 3.4l-1.6-2H17.6l-1.6 2A6 6 0 0 1 5 26a11 11 0 0 1 11-11Z" />
      <path d="M12 22v6M9 25h6" />
      <circle cx="31" cy="23" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="35" cy="27" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  // Audífonos / música
  music: (
    <>
      <path d="M10 29v-5a14 14 0 0 1 28 0v5" />
      <rect x="6" y="28" width="9" height="13" rx="4" fill="currentColor" fillOpacity=".2" />
      <rect x="6" y="28" width="9" height="13" rx="4" />
      <rect x="33" y="28" width="9" height="13" rx="4" fill="currentColor" fillOpacity=".2" />
      <rect x="33" y="28" width="9" height="13" rx="4" />
    </>
  ),
  // Teléfono / redes
  phone: (
    <>
      <rect x="13" y="4" width="22" height="40" rx="5" fill="currentColor" fillOpacity=".14" />
      <rect x="13" y="4" width="22" height="40" rx="5" />
      <path d="M21 38h6" />
    </>
  ),
  // Cámara / captura
  camera: (
    <>
      <rect x="5" y="14" width="38" height="27" rx="5" fill="currentColor" fillOpacity=".14" />
      <rect x="5" y="14" width="38" height="27" rx="5" />
      <path d="M17 14l3-5h8l3 5" />
      <circle cx="24" cy="28" r="7" />
    </>
  ),
  // Gota / hidratarse
  drop: (
    <>
      <path d="M24 6c6 8 11 13 11 20a11 11 0 0 1-22 0c0-7 5-12 11-20Z" fill="currentColor" fillOpacity=".16" />
      <path d="M24 6c6 8 11 13 11 20a11 11 0 0 1-22 0c0-7 5-12 11-20Z" />
    </>
  ),
  // Ojo / descansar la vista
  eye: (
    <>
      <path d="M4 24s8-13 20-13 20 13 20 13-8 13-20 13S4 24 4 24Z" fill="currentColor" fillOpacity=".14" />
      <path d="M4 24s8-13 20-13 20 13 20 13-8 13-20 13S4 24 4 24Z" />
      <circle cx="24" cy="24" r="5" fill="currentColor" stroke="none" />
    </>
  ),
  // Café / descanso
  coffee: (
    <>
      <path d="M8 15h26v11a13 13 0 0 1-26 0Z" fill="currentColor" fillOpacity=".16" />
      <path d="M8 15h26v11a13 13 0 0 1-26 0Z" />
      <path d="M34 18h4a5 5 0 0 1 0 10h-4" />
      <path d="M15 5c-1 2 1 3 0 5M23 5c-1 2 1 3 0 5" />
    </>
  ),
  // Hoja / descanso zen
  leaf: (
    <>
      <path d="M40 8c2 18-8 30-24 30-3 0-6-1-8-2 0-14 10-26 32-28Z" fill="currentColor" fillOpacity=".16" />
      <path d="M40 8c2 18-8 30-24 30-3 0-6-1-8-2 0-14 10-26 32-28Z" />
      <path d="M28 20C20 24 14 30 10 38" />
    </>
  ),
  // X en círculo / rechazado
  cross: (
    <>
      <circle cx="24" cy="24" r="18" fill="currentColor" fillOpacity=".12" />
      <circle cx="24" cy="24" r="18" />
      <path d="M17 17l14 14M31 17 17 31" />
    </>
  ),
  // Prohibido / bloqueado
  ban: (
    <>
      <circle cx="24" cy="24" r="18" fill="currentColor" fillOpacity=".12" />
      <circle cx="24" cy="24" r="18" />
      <path d="M11 11 37 37" />
    </>
  ),
  // Engranaje / configuración
  gear: (
    <>
      <circle cx="24" cy="24" r="7" fill="currentColor" fillOpacity=".18" />
      <circle cx="24" cy="24" r="7" />
      <path d="M24 4v6M24 38v6M4 24h6M38 24h6M9.9 9.9l4.2 4.2M33.9 33.9l4.2 4.2M38.1 9.9l-4.2 4.2M14.1 33.9l-4.2 4.2" />
    </>
  ),
  // Papelera / eliminar
  trash: (
    <>
      <path d="M10 13h28l-2.5 29a3 3 0 0 1-3 2.7h-17a3 3 0 0 1-3-2.7Z" fill="currentColor" fillOpacity=".14" />
      <path d="M10 13h28l-2.5 29a3 3 0 0 1-3 2.7h-17a3 3 0 0 1-3-2.7Z" />
      <path d="M6 13h36M18 13V8a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v5" />
      <path d="M19 21v15M29 21v15" />
    </>
  ),
  // Estrella / puntuación
  star: (
    <>
      <path d="M24 5l5.5 12.5L43 19l-10 9 3 14-12-7-12 7 3-14L5 19l13.5-1.5Z" fill="currentColor" fillOpacity=".18" />
      <path d="M24 5l5.5 12.5L43 19l-10 9 3 14-12-7-12 7 3-14L5 19l13.5-1.5Z" />
    </>
  ),
}

export default function Sticker({ name = 'spark', size = 48, className = '', strokeWidth = 2.2 }) {
  const content = PATHS[name] || PATHS.spark
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={`sx-sticker ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {content}
    </svg>
  )
}
