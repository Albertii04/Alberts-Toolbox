import type { Component } from 'vue'

import Slide01 from './slides/Slide01_Cover.vue'
import Slide02 from './slides/Slide02_Problem.vue'
import Slide03 from './slides/Slide03_Workflow.vue'
import Slide04 from './slides/Slide04_CAD.vue'
import Slide05 from './slides/Slide05_SketchUp.vue'
import Slide07 from './slides/Slide07_Library.vue'
import Slide10 from './slides/Slide10_BeforeAfter.vue'
import Slide10b from './slides/Slide10b_Ready.vue'
import Slide10c from './slides/Slide10c_ZoomD5.vue'
import Slide11 from './slides/Slide11_Server.vue'
import Slide11b from './slides/Slide11b_ZoomPanel.vue'
import Slide13 from './slides/Slide13_Refs.vue'
import Slide14 from './slides/Slide14_Style.vue'
import Slide15 from './slides/Slide15_Prompt.vue'
import Slide15b from './slides/Slide15b_Settings.vue'
import Slide16 from './slides/Slide16_Rendering.vue'
import Slide17 from './slides/Slide17_Final.vue'
import Slide18 from './slides/Slide18_Outcomes.vue'
import Slide19 from './slides/Slide19_Close.vue'

export interface SlideEntry {
  component: Component
  title: string
  notes: string
}

export const slides: SlideEntry[] = [
  { component: Slide01, title: 'Portada', notes: 'Saluda. Audiencia: arquitectos AutoCAD-first, no AI-adapted. Promesa concreta: render fotorrealista en una tarde, antes de firmar. Q&A al final.' },
  { component: Slide02, title: 'El problema', notes: 'Render tradicional ~1 semana. Renderista profesional se reserva para post-firma. En captación no podemos pedir esa espera. Pregunta: ¿podemos darle imagen el mismo día?' },
  { component: Slide03, title: 'El flujo', notes: 'Cuatro pasos. Tú mismo. Misma tarde. Adelanta cada paso brevemente — luego entramos al detalle.' },
  { component: Slide04, title: 'Paso 1 — CAD', notes: 'AutoCAD-friendly: ya trabajan así. Capas y bloques con nombres compartidos. Sin esos nombres, lo demás no funciona — pero no obliga a cambiar la forma de trabajar.' },
  { component: Slide05, title: 'Paso 2 — SketchUp', notes: 'Sub-estados: 0 = intro sin zoom · 1 = mismo texto + zoom al icono C · 2 = nuevo texto sobre la extensión (hace 95% del trabajo) con imagen ya zoomeada. Usa botones presenter o flecha →.' },
  { component: Slide07, title: 'Librería (3 sub-estados)', notes: 'Flecha → 3 veces. 1) Familias. 2) Modelos por familia. 3) Variantes (color/acabado). Énfasis: 1:1, no "parecido". El bloque del CAD apunta a la variante exacta.' },
  { component: Slide10, title: 'Antes / Después', notes: 'Slider en 97% crudo. Arrastra para revelar retocado. Mensaje: la extensión hace la masa, nosotros matizamos. No es reconstruir — son pocos minutos.' },
  { component: Slide10b, title: 'Modelo listo', notes: 'Mobiliario colocado, materiales puestos, encuadre decidido. Pasamos al ordenador con tarjeta gráfica potente para renderizar.' },
  { component: Slide10c, title: 'Zoom D5 Lite', notes: 'D5 Lite = plugin gratuito que renderiza con IA SIN salir de SketchUp. No hay segundo programa. Trabajan sobre la misma escena.' },
  { component: Slide11, title: 'D5 panel abierto', notes: 'Abre ventana flotante encima del modelo. Desde ahí controlamos todo. La escena de SketchUp es la que va a renderizar.' },
  { component: Slide11b, title: 'Zoom panel D5', notes: 'Estilo, iluminación, encuadre, instrucciones. Cambios en directo — resultado en segundos, no horas.' },
  { component: Slide13, title: 'Referencias del cliente', notes: 'Cliente nos da 4 imágenes de referencia. Cada una da una dirección visual distinta. Renderizamos el mismo espacio contra cada una.' },
  { component: Slide14, title: 'Estilo D5', notes: 'D5 trae estilos preparados. Para farmacia: Photo Realistic Interior. Importante: respeta los muebles del modelo, no se inventa cosas.' },
  { component: Slide15, title: 'Prompt — instrucción a la IA', notes: 'EXPLICAR qué es un prompt: instrucciones en lenguaje normal. Sin códigos, sin comandos. Como hablarle a una persona.' },
  { component: Slide15b, title: 'Ajustes', notes: 'Tamaño imagen, referencia, intensidad luz, cámara. Lo de un render normal pero en panel y en segundos.' },
  { component: Slide16, title: 'Renderizando', notes: '20-60 segundos por imagen. Sin nube — todo local. Tiempo de hacer 5 versiones mientras se enfría el café.' },
  { component: Slide17, title: 'Render final · 4 variantes', notes: 'Slider en 97% antes. Arrastra para revelar render. Flecha → cicla las 4 variantes. Mismo CAD, 4 referencias, 4 imágenes para enseñar al cliente.' },
  { component: Slide18, title: 'Lo que cambia', notes: 'Cifras: 15 min vs 1 semana · 0 firmas necesarias · 0€ renderista en exploración. Énfasis: el profesional sigue siendo necesario para la imagen final (web, dossier).' },
  { component: Slide19, title: 'Cierre', notes: 'Frase: "Renderizamos antes. Decidimos después. El orden cambia todo." Pausa. Q&A.' },
]
