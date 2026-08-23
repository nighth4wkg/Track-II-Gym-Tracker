import { test, expect, type Page } from "@playwright/test";

const e2eUsername = process.env.E2E_USERNAME ?? "";
const e2ePassword = process.env.E2E_PASSWORD ?? "";
const hasAuthenticatedFixture = Boolean(e2eUsername && e2ePassword);

async function signIn(page: Page) {
  await page.goto("/");
  await page.getByLabel("Username or email").fill(e2eUsername);
  await page.getByLabel("Password").fill(e2ePassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("navigation", { name: /Primary pages/ })).toBeVisible({ timeout: 30_000 });
}

async function removeExerciseIfPresent(page: Page, exerciseName: string) {
  const closeSettings = page.getByRole("button", { name: "Close settings" });
  if (await closeSettings.isVisible().catch(() => false)) await closeSettings.click();
  const navigation = page.getByRole("navigation", { name: /Primary pages/ });
  const workoutTab = navigation.getByRole("button", { name: "Workout", exact: true });
  if (await workoutTab.isVisible().catch(() => false)) await workoutTab.click();
  const options = page.getByRole("button", { name: `${exerciseName} options` });
  if (!(await options.isVisible().catch(() => false))) return;
  await options.click();
  await page.getByRole("button", { name: "Delete exercise", exact: true }).click();
  await expect(page.getByText(exerciseName, { exact: true })).toHaveCount(0);
  await expect(page.locator('.header-sync-status[aria-label="Saved"]')).toBeVisible({ timeout: 15_000 });
}

test.describe("public boot and authentication surface", () => {
  test("loads the private sign-in surface without horizontal overflow", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Track II");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel("Username or email")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel("Password")).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });

  test("auth mode switching keeps the form usable", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /New to Track II/ }).click();
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await expect(page.getByLabel("Username")).toBeVisible();
    await page.getByRole("button", { name: /Already have an account/ }).click();
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  });
});

test.describe("authenticated page smoke coverage", () => {
  test.skip(!hasAuthenticatedFixture, "Set E2E_USERNAME and E2E_PASSWORD for authenticated browser coverage.");

  test("navigates through workout, calendar, rank, timer, and settings", async ({ page }) => {
    await signIn(page);
    const navigation = page.getByRole("navigation", { name: /Primary pages/ });
    const uniqueExercise = `E2E Navigation ${Date.now()}`;
    try {
      await expect(page.getByLabel("Search exercise library")).toBeVisible();
      await page.getByLabel("Search exercise library").fill(uniqueExercise);
      await page.getByRole("button", { name: "Add exercise", exact: true }).click();
      await expect(page.getByText(uniqueExercise, { exact: true })).toBeVisible();

      for (const pageName of ["Calendar", "Rank", "Timer", "Workout"]) {
        await navigation.getByRole("button", { name: pageName, exact: true }).click();
        await expect(navigation.getByRole("button", { name: pageName, exact: true })).toHaveAttribute(
          "aria-current",
          "page",
        );
      }

      await navigation.getByRole("button", { name: "Calendar", exact: true }).click();
      await expect(page.locator(".calendar-screen")).toBeVisible();
      await navigation.getByRole("button", { name: "Rank", exact: true }).click();
      await expect(page.locator(".rank-screen")).toBeVisible();
      await navigation.getByRole("button", { name: "Timer", exact: true }).click();
      await expect(page.locator(".timer-screen")).toBeVisible();

      await page.getByRole("button", { name: "Open settings" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByRole("button", { name: "Close settings" }).click();
    } finally {
      await removeExerciseIfPresent(page, uniqueExercise);
    }
  });

  test("mobile layout keeps the app inside the viewport", async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole("navigation", { name: /Primary pages/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });

  test("browser haptics use the navigator fallback", async ({ page }) => {
    await signIn(page);
    await page.evaluate(() => {
      let calls = 0;
      Object.defineProperty(navigator, "__trackHapticCalls", { configurable: true, value: () => calls });
      Object.defineProperty(navigator, "vibrate", {
        configurable: true,
        value: () => {
          calls += 1;
          return true;
        },
      });
    });
    await page
      .getByRole("navigation", { name: /Primary pages/ })
      .getByRole("button", { name: "Calendar", exact: true })
      .click();
    // SAFETY: the test installs this diagnostic function on the browser navigator immediately above.
    expect(
      await page.evaluate(
        () => (navigator as Navigator & { __trackHapticCalls?: () => number }).__trackHapticCalls?.() ?? 0,
      ),
    ).toBeGreaterThan(0);
  });

  test("two signed-in browser contexts converge on a workout edit", async ({ browser }) => {
    const firstContext = await browser.newContext();
    const secondContext = await browser.newContext();
    const firstPage = await firstContext.newPage();
    const secondPage = await secondContext.newPage();
    const uniqueExercise = `E2E Sync ${Date.now()}`;
    try {
      await signIn(firstPage);
      await signIn(secondPage);
      await firstPage.getByLabel("Search exercise library").fill(uniqueExercise);
      await firstPage.getByRole("button", { name: "Add exercise", exact: true }).click();
      await expect(firstPage.getByText(uniqueExercise, { exact: true })).toBeVisible();
      await expect(secondPage.getByText(uniqueExercise, { exact: true })).toBeVisible({ timeout: 30_000 });
    } finally {
      await removeExerciseIfPresent(firstPage, uniqueExercise).catch(() => undefined);
      await secondContext.close();
      await firstContext.close();
    }
  });
});
