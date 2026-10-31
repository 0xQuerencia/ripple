import { test, expect } from "@playwright/test";

const steps = (page) => page.getByTestId("story-step");
const inspect = (page, name) =>
  page.getByRole("button", { name: `Inspect ${name}`, exact: true });

async function settled(page) {
  // Effects are revealed one at a time (about 750ms apart), so allow for the whole ripple.
  await expect(page.locator(".playback-status")).toContainText(
    "possible effect",
    { timeout: 15_000 },
  );
}
async function blackout(page) {
  await page.getByTestId("cause-blackout").click();
  await inspect(page, "energy").click();
}

test("the world has all systems and only compatible causes run", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".system-node")).toHaveCount(12);
  await expect(page.locator(".react-flow__edge")).toHaveCount(26);
  await page.getByTestId("cause-blackout").click();
  await inspect(page, "nature").click();
  await expect(steps(page)).toHaveCount(0);
  await expect(page.locator(".toast")).toContainText("onto energy");
});

test("playback steps, rewinds, traces ancestry, and resets", async ({
  page,
}) => {
  await page.goto("/");
  await blackout(page);
  await settled(page);
  const slider = page.getByRole("slider", { name: "Scrub through the ripple" });
  await slider.fill("1");
  await expect(steps(page)).toHaveCount(1);
  await page.getByRole("button", { name: "step", exact: true }).click();
  await expect(steps(page)).toHaveCount(2);
  await slider.fill("0");
  await expect(steps(page)).toHaveCount(0);
  await slider.fill("8");
  await expect(steps(page)).toHaveCount(8);
  await steps(page).last().click();
  await expect(page.getByTestId("ancestry").locator("li")).toHaveText([
    "energy",
    "transport",
    "industry",
    "economy",
  ]);
  await page.getByRole("button", { name: "start over" }).click();
  await expect(steps(page)).toHaveCount(0);
  await expect(page.locator(".system-node.is-affected")).toHaveCount(0);
});

test("pinned experiments survive reset and can be compared", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await blackout(page);
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
  await inspect(page, "industry").click();
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
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await inspect(page, "water").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("subject-name")).toHaveText("water");
  await page
    .getByRole("textbox", { name: "Your own cause" })
    .fill("a rainy weekend");
  await page.getByRole("button", { name: "try it on water" }).click();
  await expect(steps(page).first()).toContainText("a rainy weekend");
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

test("cause stickers support drag and drop", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByTestId("cause-blackout").dragTo(inspect(page, "energy"));
  await settled(page);
  await expect(steps(page)).toHaveCount(8);
});
