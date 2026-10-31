import { test, expect } from "@playwright/test";
async function blackout(page) {
  await page
    .getByRole("button", { name: "power outage", exact: false })
    .click();
  await page
    .getByRole("button", { name: "Inspect energy", exact: true })
    .click();
}
test("the world has all systems and only compatible causes run", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".system-node")).toHaveCount(12);
  await expect(page.locator(".react-flow__edge")).toHaveCount(26);
  await page
    .getByRole("button", { name: "power outage", exact: false })
    .click();
  await page
    .getByRole("button", { name: "Inspect nature", exact: true })
    .click();
  await expect(page.locator(".story-card")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("onto energy");
});
test("playback pauses, steps, rewinds, and resets", async ({ page }) => {
  await page.goto("/");
  await blackout(page);
  await page.getByRole("button", { name: "Pause playback" }).click();
  await expect(page.locator(".story-card")).toHaveCount(1);
  await page.getByRole("button", { name: "step", exact: false }).click();
  await expect(page.locator(".story-card")).toHaveCount(2);
  const slider = page.getByRole("slider", { name: "Rewind timeline" });
  await slider.fill("0");
  await expect(page.locator(".story-card")).toHaveCount(0);
  await slider.fill("8");
  await expect(page.locator(".story-card")).toHaveCount(8);
  await page.locator(".story-card").last().click();
  await expect(page.locator(".ancestry")).toHaveText(
    "energy → transport → industry → economy",
  );
  await page.getByRole("button", { name: "reset world" }).click();
  await expect(page.locator(".story-card")).toHaveCount(0);
  await expect(page.locator(".system-node.affected")).toHaveCount(0);
});
test("pinned experiments survive reset and can be compared", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await blackout(page);
  await page.getByRole("button", { name: "compare", exact: true }).click();
  await page.getByRole("button", { name: "pin current experiment" }).click();
  await page.getByRole("button", { name: "reset world" }).click();
  await expect(page.locator(".comparison-sheet").first()).toContainText(
    "power outage",
  );
  await expect(page.locator(".comparison-sheet").last()).toContainText(
    "A blank page",
  );
  await page.getByRole("button", { name: "the world", exact: true }).click();
  await page
    .getByRole("button", { name: "new invention", exact: false })
    .click();
  await page
    .getByRole("button", { name: "Inspect industry", exact: true })
    .click();
  await page.getByRole("button", { name: "compare", exact: true }).click();
  await expect(page.locator(".comparison-sheet").last()).toContainText(
    "new invention",
  );
  await expect(page.locator(".comparison-sheet").last()).toContainText(
    "may benefit",
  );
});
test("keyboard, mobile sizing, custom causes, and help work", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Inspect water", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".inspector h3")).toHaveText("water");
  await page
    .getByRole("textbox", { name: "Your own cause" })
    .fill("a rainy weekend");
  await page.getByRole("button", { name: "try it on water" }).click();
  await expect(page.locator(".story-card").first()).toContainText(
    "a rainy weekend",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "how to play", exact: false })
    .last()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("cause stickers support drag and drop", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page
    .getByRole("button", { name: "power outage", exact: false })
    .dragTo(page.getByRole("button", { name: "Inspect energy", exact: true }));
  await expect(page.locator(".story-card")).toHaveCount(8);
});
