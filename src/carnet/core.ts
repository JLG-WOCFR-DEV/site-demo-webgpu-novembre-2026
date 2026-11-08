/**
 * Carnet — le core Rust (carnet-core, via carnet-wasm) vu de TypeScript.
 *
 * Les types ci-dessous décrivent ce que les vues sérialisées par serde contiennent ; ils suivent
 * crates/carnet-core/src/{notebook,view}.rs. Le module wasm est généré par tools/carnet-wasm.sh.
 */
import init, { Carnet } from "./wasm/carnet.js";

export type Day = string; // AAAA-MM-JJ, date de journal sans fuseau
export type Kind = "task" | "event" | "note";
export type State = "open" | "done" | "cancelled";
/** "day" | "week:<lundi>" | "month:<AAAA-MM>" | "collection:<id>" */
export type Scope = string;
export type Place = { scope: Scope; day: Day | null };
export type Departure = { from: Place; at: number };

export type Entry = {
  id: string;
  kind: Kind;
  state: State;
  priority: boolean;
  idea: boolean;
  text: string;
  time: string | null;
  place: Place;
  createdAt: number;
  trail: Departure[];
  deletedAt: number | null;
};
/** Une ligne de vue. `departedTo` non nul : ligne « > » d'une place quittée. */
export type Line = Entry & { departedTo: Place | null };

export type SuggestionKind = "carry" | "plan" | "yearAgo" | "monthCarry";
export type Suggestion = {
  key: string;
  kind: SuggestionKind;
  entryId: string;
  text: string;
  entryKind: Kind;
  time: string | null;
  from: Place;
};
export type DayView = { day: Day; lines: Line[]; departed: Line[]; suggestions: Suggestion[] };
export type WeekView = { monday: Day; days: DayView[]; notes: Line[]; departedNotes: Line[] };
export type CalendarDay = { day: Day; count: number; headline: string | null };
export type MonthView = { month: string; calendar: CalendarDay[]; lines: Line[]; departed: Line[]; suggestions: Suggestion[] };
export type NewEntry = { kind?: Kind; text: string; time?: string | null; priority?: boolean; idea?: boolean };
export type ImportReport = { imported: number; merged_copies: number; skipped: number };

/** Les signatures typées de la classe générée (qui rend `any` pour les valeurs serde). */
export interface Core {
  apply(updates: Uint8Array[]): void;
  takeUpdates(): Uint8Array[];
  encodeState(): Uint8Array;
  stateVector(): Uint8Array;
  diff(sv: Uint8Array): Uint8Array;
  hasPending(): boolean;
  add(place: Place, entry: NewEntry): string;
  setText(id: string, text: string): void;
  spliceText(id: string, start: number, del: number, insert: string): void;
  setState(id: string, state: State): void;
  cycleState(id: string): State;
  setTime(id: string, time: string | null): void;
  setMarks(id: string, priority: boolean, idea: boolean): void;
  migrate(id: string, to: Place): void;
  delete(id: string): void;
  restore(id: string): void;
  purge(): number;
  dismiss(key: string): void;
  keep(key: string, on: Day): string;
  importV0(json: string): ImportReport;
  weekView(anyDay: Day, today: Day): WeekView;
  dayView(day: Day, today: Day, limit: number): DayView;
  monthView(month: string, today: Day): MonthView;
  get(id: string): Entry | null;
  all(): Entry[];
  isDismissed(key: string): boolean;
  /** Schéma qui a écrit ce carnet (0 : jamais marqué) et schéma que ce module sait écrire. */
  schema(): number;
  supportedSchema(): number;
  /** Faux si le carnet vient d'une version plus récente : lecture seule. */
  writable(): boolean;
  stampSchema(): void;
  free(): void;
}

let ready: Promise<unknown> | null = null;

/**
 * Charge le module wasm (une fois) et ouvre un carnet vide. `wasm` : octets ou URL du module, pour
 * Node et les tests ; dans la page, le module se trouve à côté du JS généré.
 */
export async function createCore(wasm?: BufferSource | URL): Promise<Core> {
  ready ??= wasm ? init({ module_or_path: wasm }) : init();
  await ready;
  return new Carnet() as unknown as Core;
}

export const dayPlace = (day: Day): Place => ({ scope: "day", day });
export const weekPlace = (monday: Day): Place => ({ scope: `week:${monday}`, day: null });
