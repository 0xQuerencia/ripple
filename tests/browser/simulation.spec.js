import { test, expect } from "@playwright/test";

const post = async (request, path, data) => {
  const response = await request.post(path, { data });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
};

test("local evidence can be extracted and reviewed through the original UI", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "projects", exact: true }).click();
  const title = "Evidence check " + Date.now();
  await page.getByRole("textbox", { name: "New project title" }).fill(title);
  await page.getByRole("button", { name: "new project" }).click();
  await expect(page.getByRole("button", { name: title })).toBeVisible();
  await page.getByLabel("attach TXT, MD or CSV").setInputFiles({
    name: "metrics.csv", mimeType: "text/csv",
    buffer: Buffer.from("metric,value\nChurn,5%\nCurrent price,499\n")
  });
  await expect(page.getByText("metrics.csv")).toBeVisible();
  await page.getByRole("button", { name: "extract claims" }).click();
  await expect(page.getByRole("textbox", { name: "Claim from metrics.csv" }).first())
    .toHaveValue(/Churn/);
  await page.getByRole("button", { name: "accept", exact: true }).first().click();
  await expect(page.getByText("reviewed", { exact: false }).first()).toBeVisible();
});

test("saved simulated decisions have a graph, report and comparable outcomes", async ({ page, request }) => {
  test.setTimeout(75_000);
  const project = (await post(request, "/api/projects",
    { title: "Full workflow " + Date.now() })).project;
  const root = "/api/projects/" + project.id + "/scenarios";
  const scenario = (await post(request, root, {
    companyName: "Sample SaaS",
    question: "What happens if our subscription price changes?",
    baselinePrice: 499, marketingBudget: 200,
    segments: [{ id: "group", label: "Monthly subscribers",
      customers: 100, monthlyChurn: 0.05 }],
    interventions: [
      { label: "full rollout", price: 599, rolloutPercent: 100 },
      { label: "pilot rollout", price: 599, rolloutPercent: 20 }
    ],
    rounds: 3
  })).scenario;
  const runRoot = root + "/" + scenario.id + "/runs";
  const baseline = await post(request, runRoot, { interventionId: "baseline" });
  await expect.poll(async () => {
    const response = await request.get("/api/simulation-jobs/" + baseline.job.id);
    return (await response.json()).job.status;
  }, { timeout: 20_000 }).toBe("done");

  await page.goto("/");
  await page.getByRole("button", { name: "simulation", exact: true }).click();
  await page.getByLabel("Simulation project").selectOption(project.id);
  await expect(page.getByRole("heading", { name: scenario.question })).toBeVisible();
  await page.getByRole("button", { name: "run alternative" }).first().click();
  await expect(page.getByTestId("simulation-job-status")).toContainText("done",
    { timeout: 20_000 });
  await expect(page.locator(".simulation-graph .system-node").first()).toBeVisible();
  await page.getByRole("button", { name: "prepare report" }).click();
  await expect(page.getByRole("button", { name: "export markdown" })).toBeVisible();
  await expect(page.getByRole("button", { name: "export JSON" })).toBeVisible();

  await expect(page.getByLabel("Compare alternative").locator("option")).toHaveCount(3);
  const runList = await request.get(runRoot);
  expect(runList.ok()).toBe(true);
  const alternative = (await runList.json()).runs.find((run) =>
    run.interventionId === "option-0");
  expect(alternative).toBeTruthy();
  await page.getByLabel("Compare baseline").selectOption(baseline.run.id);
  await page.getByLabel("Compare alternative").selectOption(alternative.id);
  await page.getByRole("button", { name: "compare runs" }).click();
  await expect(page.getByRole("region", { name: "Run comparison" }))
    .toContainText("currentPrice");
});

test("reviewed evidence can be linked to scenario inputs without promoting it to fact", async ({ page, request }) => {
  const project = (await post(request, "/api/projects",
    { title: "Evidence-linked scenario " + Date.now() })).project;
  const root = "/api/projects/" + project.id;
  const source = (await post(request, root + "/sources", {
    filename: "pricing.txt", content: "Current price: 499\nMonthly churn: 5%"
  })).source;
  const extracted = await post(request, root + "/sources/" + source.id + "/extract", {});
  const [priceClaim, churnClaim] = extracted.claims;
  for (const claim of [priceClaim, churnClaim]) {
    const response = await request.patch(root + "/claims/" + claim.id,
      { data: { decision: "accept" } });
    expect(response.ok(), await response.text()).toBe(true);
  }
  await page.goto("/");
  await page.getByRole("button", { name: "simulation", exact: true }).click();
  await page.getByLabel("Simulation project").selectOption(project.id);
  await page.getByLabel("Decision question").fill("Is a higher price a good idea?");
  await page.getByLabel("company or product").fill("Example");
  await page.getByLabel("current price").fill("499");
  await expect(page.getByLabel("Price evidence")).toBeVisible();
  await page.getByLabel("Price evidence").selectOption(priceClaim.id);
  await page.getByLabel("segment", { exact: true }).fill("Subscribers");
  await page.getByLabel("customers").fill("100");
  await page.getByLabel("historical monthly churn %").fill("5");
  await page.getByLabel("Evidence for Subscribers").selectOption(churnClaim.id);
  await page.getByLabel("new price").nth(0).fill("599");
  await page.getByLabel("new price").nth(1).fill("599");
  await page.getByRole("button", { name: "save scenario" }).click();
  await expect(page.getByText("scenario saved. compare it with the baseline.")).toBeVisible();
  const response = await request.get(root + "/scenarios");
  expect(response.ok()).toBe(true);
  const saved = (await response.json()).scenarios[0];
  expect(saved.baselineState.entities[0].sourceClaimIds).toEqual([priceClaim.id]);
  expect(saved.baselineState.entities[1].sourceClaimIds).toEqual([churnClaim.id]);
  expect(saved.baselineState.entities[0].provenance).toBe("assumption");
  expect(saved.baselineState.entities[1].provenance).toBe("assumption");
});
