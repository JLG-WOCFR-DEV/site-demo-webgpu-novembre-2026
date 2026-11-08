import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parseIcs } from "./ics.ts";

// Les heures murales dépendent du fuseau de la machine : les tests le fixent.
process.env.TZ = "Europe/Paris";
const now = new Date(2026, 10, 8, 12, 0);
const cal = (...events: string[]) => ["BEGIN:VCALENDAR", "VERSION:2.0", ...events, "END:VCALENDAR"].join("\r\n");
const ev = (...props: string[]) => ["BEGIN:VEVENT", ...props, "END:VEVENT"].join("\r\n");

describe("import .ics", () => {
  test("heure UTC, fuseau nommé, heure flottante, journée entière", () => {
    const r = parseIcs(
      cal(
        ev("UID:a", "DTSTART:20261112T130000Z", "SUMMARY:Dentiste"),
        ev("UID:b", "DTSTART;TZID=America/New_York:20261112T090000", "SUMMARY:Appel New York"),
        ev("UID:c", "DTSTART:20261113T191500", "SUMMARY:Concert\\, salle 2", "LOCATION:Le Vauban"),
        ev("UID:d", "DTSTART;VALUE=DATE:20261124", "SUMMARY:Anniversaire de Léa"),
      ),
      now,
    );
    assert.deepEqual(
      r.events.map((e) => [e.day, e.time, e.summary]),
      [
        ["2026-11-12", "14:00", "Dentiste"],
        ["2026-11-12", "15:00", "Appel New York"],
        ["2026-11-13", "19:15", "Concert, salle 2"],
        ["2026-11-24", null, "Anniversaire de Léa"],
      ],
    );
    assert.equal(r.events[2]!.location, "Le Vauban");
  });

  test("lignes repliées, événement annulé, alarme imbriquée", () => {
    const r = parseIcs(
      cal(
        ev("UID:x", "DTSTART:20261120T100000", "SUMMARY:Réunion d'équipe sur", "  le budget", "BEGIN:VALARM", "TRIGGER:-PT15M", "DESCRIPTION:Rappel", "END:VALARM"),
        ev("UID:y", "DTSTART:20261121T100000", "SUMMARY:Annulé", "STATUS:CANCELLED"),
      ),
      now,
    );
    assert.deepEqual(r.events.map((e) => e.summary), ["Réunion d'équipe sur le budget"]);
    assert.equal(r.skipped, 1);
  });

  test("récurrences : hebdo sur deux jours, mensuelle un 31, exceptions, fenêtre d'un an", () => {
    const r = parseIcs(
      cal(
        ev("UID:yoga", "DTSTART:20261103T183000", "RRULE:FREQ=WEEKLY;BYDAY=TU,TH;COUNT=6", "EXDATE:20261110T183000", "SUMMARY:Yoga"),
        ev("UID:loyer", "DTSTART;VALUE=DATE:20261031", "RRULE:FREQ=MONTHLY", "SUMMARY:Loyer"),
        ev("UID:odd", "DTSTART:20261101T100000", "RRULE:FREQ=MONTHLY;BYSETPOS=-1;BYDAY=FR", "SUMMARY:Règle rare"),
      ),
      now,
    );
    const yoga = r.events.filter((e) => e.summary === "Yoga").map((e) => e.day);
    assert.deepEqual(yoga, ["2026-11-03", "2026-11-05", "2026-11-12", "2026-11-17", "2026-11-19"]);
    const loyer = r.events.filter((e) => e.summary === "Loyer").map((e) => e.day);
    assert.ok(loyer.includes("2026-12-31") && !loyer.some((d) => d.startsWith("2026-11") || d.startsWith("2027-02")), loyer.join());
    assert.ok(loyer.every((d) => d <= "2027-11-08"));
    assert.equal(r.unsupported, 1);
  });
});
