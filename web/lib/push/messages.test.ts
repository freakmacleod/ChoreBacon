import { describe, expect, it } from "vitest";
import { comboMessage, formatDeadline, reminderMessage, swedishList, temporaryChoreMessage } from "./messages";

const friday18 = new Date("2026-11-20T17:00:00Z"); // 18:00 in Stockholm

describe("push notification texts", () => {
  it("writes deadlines in Swedish time", () => {
    expect(formatDeadline(friday18)).toMatch(/^fre 20 nov\.? 18:00$/);
  });

  it("lists things the Swedish way", () => {
    expect(swedishList([])).toBe("");
    expect(swedishList(["Diska"])).toBe("Diska");
    expect(swedishList(["Diska", "Bädda"])).toBe("Diska och Bädda");
    expect(swedishList(["Diska", "Bädda", "Sopor"])).toBe("Diska, Bädda och Sopor");
    expect(swedishList(["A", "B", "C", "D", "E"])).toBe("A, B, C och 2 till");
  });

  it("announces a temporary chore and a new combo", () => {
    const chore = temporaryChoreMessage({ id: "c1", title: "Kratta löv", points: 50, expiresAt: friday18 });
    expect(chore.title).toBe("⏳ Ny tidsbegränsad syssla");
    expect(chore.body).toMatch(/^Kratta löv – 50 poäng\. Först till kvarn, senast fre 20 nov\.? 18:00\.$/);
    expect(chore.data).toEqual({ kind: "temporary_chore", choreId: "c1" });

    expect(comboMessage({ id: "k1", title: "Morgonrutin", bonusPoints: 20, period: "day" }).body).toBe(
      "Morgonrutin: gör alla sysslorna samma dag och få 20 bonuspoäng.",
    );
    expect(comboMessage({ id: "k1", title: "Veckans hjälte", bonusPoints: 40, period: "week" }).body).toContain("samma vecka");
  });

  it("reminds about undone daily chores, close deadlines and unfinished combos", () => {
    const message = reminderMessage({
      undone: ["Bädda sängen", "Diska"],
      expiring: [{ title: "Kratta löv", expiresAt: friday18 }],
      combos: [
        { title: "Morgonrutin", left: 1, bonusPoints: 20 },
        { title: "Veckans hjälte", left: 2, bonusPoints: 40 },
      ],
    });
    expect(message?.title).toBe("Glöm inte dina sysslor! 🥓");
    expect(message?.body.split("\n")).toEqual([
      "Kvar idag: Bädda sängen och Diska.",
      expect.stringMatching(/^⏳ Kratta löv – senast fre 20 nov\.? 18:00\.$/),
      "🎰 1 syssla kvar till Morgonrutin (+20).",
      "🎰 2 sysslor kvar till Veckans hjälte (+40).",
    ]);
  });

  it("stays quiet when everything is done", () => {
    expect(reminderMessage({ undone: [], expiring: [], combos: [] })).toBeNull();
  });
});
