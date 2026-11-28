// Couche de verre — l'enveloppe Presse de GlassLayer (bilalgursen/liquid-glass, MIT, voir README.md).
//
// `monterCouche(host, options)` fait ce que faisait le composant React : crée le canvas (premier enfant, sous le
// contenu), injecte GLASS_CSS une fois, monte la vue (`construire`, le corps de l'effet repris tel quel dans
// couche-amont.ts) et la reconstruit quand une option de construction change (les dépendances de l'effet). Les autres
// options (teinte, flou, optique, gouttelette) sont lues à chaque image : elles ne reconstruisent rien.
//
// L'hôte : un élément positionné (le module verre s'en charge). Sans WebGL2, rien ne change (l'hôte garde son allure
// CSS) ; prêt, l'hôte porte `data-glass-ready` et GLASS_CSS retire son fond, sa bordure et son ombre.

import { construire, GLASS_CSS, type Construction, type Etat, type GlassLayerProps, type Liens } from './couche-amont.ts'
import { getGlassEngine } from './engine.ts'

export { GLASS_CSS, type GlassMaterial, type GlassDroplet, type GlassOptics, type GlassLayerProps } from './couche-amont.ts'

/** Les options d'une couche : celles de GlassLayer, sans `pulse` (remplacé par `impulsion()`). */
export type OptionsCouche = Omit<GlassLayerProps, 'pulse'>

/** Les options qui reconstruisent la couche quand elles changent (les dépendances de l'effet React). */
export const CONSTRUCTION = ['material', 'backdrop', 'live', 'trigger', 'disabled', 'swell', 'pull'] as const

export type Couche = {
  readonly canvas: HTMLCanvasElement
  /** Change des options : réglages lus à chaque image (teinte, flou, optique) ou reconstruction. */
  regler(options: Partial<OptionsCouche>): void
  /** Le verre répond une fois, comme survolé et pressé un instant (le `pulse` de GlassLayer). */
  impulsion(): void
  detruire(): void
}

/** WebGL2 est là (le moteur partagé se crée au premier appel) ; `false` : l'allure CSS reste. */
export const moteurDisponible = (): boolean => getGlassEngine() !== null

/** GLASS_CSS, une fois par document (le `<GlassStyles />` de React). */
export function assurerStyles(doc: Document = document): void {
  if (doc.querySelector('style[data-liquid-glass]')) return
  const style = doc.createElement('style')
  style.setAttribute('data-liquid-glass', '')
  style.textContent = GLASS_CSS
  doc.head.append(style)
}

export function monterCouche(host: HTMLElement, options: OptionsCouche = {}): Couche {
  assurerStyles(host.ownerDocument)
  host.setAttribute('data-glass-host', '')
  const canvas = host.ownerDocument.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.setAttribute('data-glass-skip', '')
  Object.assign(canvas.style, { position: 'absolute', zIndex: '-1', maxWidth: 'none', pointerEvents: 'none', width: '0px', height: '0px' })
  host.prepend(canvas)
  let o: OptionsCouche = { ...options }
  const construction = (): Construction => ({
    material: o.material ?? 'clear',
    backdrop: o.backdrop,
    live: o.live ?? false,
    trigger: o.trigger,
    disabled: o.disabled ?? false,
    swell: o.swell ?? true,
    pull: o.pull ?? true,
  })
  const etat: Etat = { droplet: 'none', tint: 0.6, blur: 0, optics: undefined, restHeight: undefined, pulseHold: undefined }
  const lire = () => {
    etat.droplet = o.droplet ?? 'none'
    etat.tint = o.tint ?? 0.6
    etat.blur = o.blur ?? 0
    etat.optics = o.optics
    etat.restHeight = o.restHeight
    etat.pulseHold = o.pulseHold
  }
  lire()
  const liens: Liens = { poke: null, nod: null, pulse: null }
  let nettoyer = construire(canvas, construction(), etat, liens)
  return {
    canvas,
    regler(partiel) {
      const avant = o
      o = { ...o, ...partiel }
      lire()
      const from = avant.droplet ?? 'none'
      const to = etat.droplet
      if (CONSTRUCTION.some((k) => avant[k] !== o[k])) {
        nettoyer?.()
        nettoyer = construire(canvas, construction(), etat, liens)
        return
      }
      liens.poke?.()
      if (from !== to && from !== 'none' && to !== 'none') liens.nod?.()
    },
    impulsion: () => liens.pulse?.(),
    detruire() {
      nettoyer?.()
      nettoyer = undefined
      canvas.remove()
      host.removeAttribute('data-glass-host')
    },
  }
}
