import { test, expect } from "@playwright/test";
import { CAUSES, SYSTEM_BY_ID } from "../../shared/world.mjs";
import { createScenario, getAncestry } from "../../shared/scenario.mjs";

const steps = (page) => page.getByTestId("story-step");
const nodes = (page) => page.locator(".system-node");
const inspect = (page, name) =>
  page.getByRole("button", { name: `Inspect ${name}`, exact: true });

const blackout = CAUSES.find((c) => c.id === "blackout");
const expected = createScenario(blackout, blackout.target, "expected");
const nameOf = (event) => SYSTEM_BY_ID[event.targetId].name;

async function settled(page) {
  // Effects are revealed one at a time unless reduced motion is on, so allow for a whole ripple.
  await expect(page.locator(".playback-status")).toContainText(
    "possible effect",
    { timeout: 30_000 },
  );
}
async function reduceMotion(page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
}

test("the empty map invites any question, and an example starts a ripple", async ({
  page,
}) => {
  await reduceMotion(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "ask me anything." }),
  ).toBeVisible();
  await expect(page.locator(".examples button")).toHaveCount(8);
  await expect(nodes(page)).toHaveCount(0);
  await page.getByRole("button", { name: "hackers die" }).click();
  await settled(page);
  expect(await nodes(page).count()).toBeGreaterThan(4);
  // every node after the first hangs off an earlier one
  await expect(page.locator(".react-flow__edge")).toHaveCount(
    (await nodes(page).count()) - 1,
  );
  await expect(page.locator(".picture")).toContainText("areas of life");
});

test("playback steps, rewinds, traces ancestry, and resets", async ({
  page,
}) => {
  await reduceMotion(page);
  await page.goto("/");
  await page.getByTestId("cause-blackout").click();
  await settled(page);
  const slider = page.getByRole("slider", { name: "Scrub through the ripple" });
  await slider.fill("1");
  await expect(steps(page)).toHaveCount(1);
  await page.getByRole("button", { name: "step", exact: true }).click();
  await expect(steps(page)).toHaveCount(2);
  await slider.fill("0");
  await expect(steps(page)).toHaveCount(0);
  await slider.fill(String(expected.length));
  await expect(steps(page)).toHaveCount(expected.length);
  await steps(page).last().click();
  await expect(page.getByTestId("ancestry").locator("li")).toHaveText(
    getAncestry(expected, expected.at(-1).id).map(nameOf),
  );
  await page.getByRole("button", { name: "start over" }).click();
  await expect(steps(page)).toHaveCount(0);
  await expect(nodes(page)).toHaveCount(0);
});

test("pinned experiments survive reset and can be compared", async ({
  page,
}) => {
  await reduceMotion(page);
  await page.goto("/");
  await page.getByTestId("cause-blackout").click();
  await settled(page);
  await page.getByRole("button", { name: "compare", exact: true }).click();
  await page.getByRole("button", { name: "pin this one" }).click();
  await page.getByRole("button", { name: "start over" }).click();
  await expect(page.getByTestId("sheet").first()).toContainText("power outage");
  await expect(page.getByTestId("sheet").last()).toContainText(
    "run an experiment",
  );
  await page.getByRole("button", { name: "the world", exact: true }).click();
  await page.getByTestId("cause-discovery").click();
  await settled(page);
  await page.getByRole("button", { name: "compare", exact: true }).click();
  await expect(page.getByTestId("sheet").last()).toContainText("new invention");
  await expect(page.getByTestId("sheet").last()).toContainText("may benefit");
});

test("keyboard, mobile sizing, custom causes, and help work", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await reduceMotion(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Your own cause" })
    .fill("a rainy weekend");
  await page
    .locator(".whatif")
    .getByRole("button", { name: "see what happens" })
    .click();
  await settled(page);
  await expect(steps(page).first()).toContainText("a rainy weekend");
  // keyboard: focus a node and press Enter to read its notes
  const second = expected.length > 1 ? nameOf(expected[1]) : "";
  expect(second).not.toBe("");
  const target = page.locator(".system-node .node-face").nth(1);
  await target.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("subject-name")).not.toHaveText("");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "how to play" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("cause stickers can be dropped onto the map", async ({ page }) => {
  await reduceMotion(page);
  await page.goto("/");
  await page.getByTestId("cause-blackout").dragTo(page.locator(".canvas"));
  await settled(page);
  await expect(steps(page)).toHaveCount(expected.length);
});

test("a judge can just start typing a brand new question and watch Gemma work", async ({
  page,
}) => {
  await page.goto("/");
  // nothing was clicked: the big box already has the keyboard
  await expect(page.locator("#ask-text")).toBeFocused();
  await page.keyboard.type("what if cats ruled the world");
  await page.keyboard.press("Enter");
  // while the ripple is being written, a live panel shows what is happening
  await expect(page.locator(".live")).toBeVisible();
  await expect(page.locator(".live")).toContainText("it begins at");
  await settled(page);
  await expect(page.locator(".live")).toHaveCount(0);
  await expect(steps(page).first()).toContainText(
    "what if cats ruled the world",
  );
  expect(await nodes(page).count()).toBeGreaterThan(4);
});

test("shift+enter adds a line instead of sending", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.type("first line");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("second line");
  await expect(page.locator("#ask-text")).toHaveValue(
    "first line\nsecond line",
  );
  await expect(nodes(page)).toHaveCount(0);
});

test("long questions are accepted up to the limit and no further", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#ask-text").fill("x".repeat(400));
  expect((await page.locator("#ask-text").inputValue()).length).toBe(160);
});
