/**
 * L'API publique de Presse : la seule porte d'entrée pour une application
 * qui s'appuie sur le moteur (Carnet, puis le futur paquet npm, feuille de
 * route D12). Tout ce qui n'est pas exporté ici est un détail interne du site
 * démo et peut changer sans prévenir.
 *
 * Ce que l'application reçoit :
 *   - le moteur (presse), avec le mode à la demande (onDemand) et wake() ;
 *   - le texte repeint par le GPU et son morphing, y compris entre deux
 *     éléments (data-gl-morph-id sur la source, data-gl-morph-from sur la
 *     cible) ;
 *   - les jetons de mouvement (courbes, durées, ressorts) partagés CSS / JS ;
 *   - le niveau de mouvement, le gouverneur de cadence, la reprise après une
 *     perte de l'appareil GPU ;
 *   - la direction artistique (applyLook).
 */
export { presse, presseFromHtml, type Presse, type PresseOptions, type Effect } from "./index.ts";
export { applyLook, LOOKS } from "./look.ts";
export { EASE, DUR, SPRINGS, springStep, spring, ease, initTokens, type Spring } from "./tokens.ts";
export { setMotionLevel, motionLevel, motionScale, onMotionLevel, type MotionLevel } from "../motion-scale.ts";
export { renderScale, onRenderScale, governorState } from "../gpu/governor.ts";
export { getDevice, onDeviceLost, recoverable } from "../components/device.ts";
