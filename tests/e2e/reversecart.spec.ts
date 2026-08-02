import { expect, test } from "@playwright/test";

test("buyer completes the entire request-to-confirmation journey", async ({ page }) => {
  await page.route("**/api/hotels?**", async (route) => {
    await route.fulfill({ json: {
      source: "liteapi",
      reference: { latitude: 12.9716, longitude: 77.5946, label: "Taj Hotel, Bengaluru" },
      hotels: [
        { id: "hotel-1", name: "Garden Residency", address: "MG Road, Bengaluru", distanceKm: 0.4, latitude: 12.972, longitude: 77.595, rating: 4.7, liveTotal: 7200 },
        { id: "hotel-2", name: "Central Suites", address: "Residency Road, Bengaluru", distanceKm: 0.8, latitude: 12.974, longitude: 77.597, rating: 4.6, liveTotal: 7600 },
        { id: "hotel-3", name: "Metro Grand", address: "Ashok Nagar, Bengaluru", distanceKm: 1.1, latitude: 12.969, longitude: 77.592, rating: 4.5, liveTotal: 7900 },
      ],
    } });
  });

  await page.goto("/");
  await page.getByRole("textbox", { name: /Describe what/i }).fill("One room near Taj Hotel, Bengaluru tonight under ₹8,000 with late check-in and breakfast.");
  await page.getByRole("button", { name: /Create my request/i }).click();
  await expect(page.getByRole("heading", { name: /what hotels will compete for/i })).toBeVisible();
  await page.getByRole("button", { name: /Invite offers/i }).click();
  const endButton = page.getByRole("button", { name: /End bidding now/i });
  await expect(endButton).toBeEnabled({ timeout: 8_000 });
  await endButton.click();
  await expect(page.getByRole("heading", { name: /best offer/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Review and pay/i })).toBeEnabled();
  await page.getByRole("button", { name: /Review and pay/i }).click();
  await expect(page.getByRole("heading", { name: /authorizing one exact purchase/i })).toBeVisible();
  await page.getByRole("button", { name: /Approve with Prava/i }).click();
  await expect(page.getByRole("heading", { name: /test reservation is confirmed/i })).toBeVisible();
  await expect(page.locator(".receipt")).toContainText("Confirmed");
  await expect(page.locator(".audit")).toContainText("Payment verified");
});

test("buyer can review and select an alternative offer", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Stop searching/i })).toBeVisible();
  await expect(page.locator("header .logo-symbol")).toBeVisible();
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-home.png`, fullPage: true });
  await page.getByRole("textbox", { name: /Describe what/i }).fill("I need 2 rooms near Taj Hotel, Bengaluru, tonight, under ₹12,000 total, with breakfast and late check-in.");
  await page.getByRole("button", { name: /Create my request/i }).click();
  await expect(page.getByRole("heading", { name: /what hotels will compete for/i })).toBeVisible();
  await expect(page.locator(".mandate-main")).toContainText("Taj Hotel, Bengaluru");
  await expect(page.locator(".mandate-main")).toContainText("₹12,000");
  await expect(page.locator(".mandate-main")).toContainText("2 rooms");
  await page.getByRole("button", { name: /Invite offers/i }).click();
  const endButton = page.getByRole("button", { name: /End bidding now/i });
  await expect(endButton).toBeEnabled({ timeout: 8_000 });
  await endButton.click();
  await expect(page.getByRole("heading", { name: /best offer/i })).toBeVisible();

  await page.getByRole("button", { name: /Show all 3 offers/i }).first().click();
  await expect(page.getByRole("region", { name: "All offers" })).toBeVisible();
  const alternativeRow = page.locator(".alternative-row").filter({ has: page.getByRole("button", { name: "Select" }) }).first();
  const alternativeName = (await alternativeRow.locator("b").first().textContent()) || "selected hotel";
  await alternativeRow.getByRole("button", { name: "Select" }).click();
  await expect(page.locator(".winner-card")).toContainText(alternativeName);
  await expect(page.getByRole("region", { name: "All offers" })).toBeHidden();
  await page.getByRole("button", { name: /Show all 3 offers/i }).first().click();
  await page.getByRole("button", { name: /Hide offers/i }).first().click();
  await expect(page.getByRole("region", { name: "All offers" })).toBeHidden();
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-offers.png`, fullPage: true });
});

test("layout has no horizontal page overflow", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await expect(page.getByRole("button", { name: /Create my request/i })).toBeVisible();
});

test("signed-in buyer can open their private market history", async ({ page }) => {
  await page.goto("/history");
  await expect(page.getByRole("heading", { name: /Your markets/i })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test("hotel destination titles are derived dynamically", async ({ request }) => {
  for (const [prompt, expected] of [
    ["Two rooms near Taj Hotel, Bengaluru, tonight, under ₹12,000.", "Taj Hotel, Bengaluru"],
    ["A hotel near Bengaluru Airport tomorrow under ₹7,000.", "Bengaluru Airport"],
    ["A quiet hotel in Indiranagar this weekend under ₹9,000.", "Indiranagar"],
  ]) {
    const response = await request.post("/api/interpret", { data: { prompt } });
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.data.destination).toContain(expected);
  }
});
