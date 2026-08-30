import { test, expect, type Page } from "@playwright/test";

const e2eUsername = process.env.E2E_USERNAME ?? "";
const e2ePassword = process.env.E2E_PASSWORD ?? "";
const hasAuthenticatedFixture = Boolean(e2eUsername && e2ePassword);
if (process.env.E2E_REQUIRE_AUTH === "1" && !hasAuthenticatedFixture)
  throw new Error("E2E_REQUIRE_AUTH=1 requires E2E_USERNAME and E2E_PASSWORD.");

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
  await expect(page.getByRole("button", { name: /Synced/ })).toBeVisible({ timeout: 15_000 });
}

function visibleNotificationTrigger(page: Page) {
  return page.locator('[data-notification-center-trigger="true"]:visible').first();
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

  test("split switching replaces the workout surface without duplicating it", async ({ page }) => {
    await signIn(page);
    const splits = page.locator("[data-split-id]");
    test.skip((await splits.count()) < 2, "The protected fixture needs at least two splits for this regression.");
    const secondSplit = splits.nth(1);
    const secondTitle = (await secondSplit.locator("span").innerText()).trim();
    await secondSplit.click();
    await expect(page.locator(".workout-page-header h1")).toHaveText(secondTitle);
    await expect(page.locator(".workout-page-header h1")).toHaveCount(1);
    await expect(page.locator(".workout-page")).toHaveCount(1);
  });

  test("inbox opens at its trigger and clear all permanently removes notifications", async ({ page }) => {
    await signIn(page);
    const notificationId = `e2e:${Date.now()}`;
    await page.evaluate((id) => {
      window.dispatchEvent(
        new CustomEvent("track-notification-created", {
          detail: {
            id,
            kind: "sync",
            title: "E2E notification",
            message: "Notification center regression fixture.",
            createdAt: Date.now(),
            unread: true,
          },
        }),
      );
    }, notificationId);
    const trigger = visibleNotificationTrigger(page);
    await expect(trigger).toBeVisible();
    await trigger.click();
    const panel = page.getByRole("dialog", { name: "Notification center" });
    const backdrop = page.locator(".notification-center-backdrop");
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute("aria-modal", "true");
    await expect(backdrop).toBeVisible();
    const panelBounds = await panel.boundingBox();
    const viewport = page.viewportSize();
    expect(panelBounds).not.toBeNull();
    if (panelBounds && viewport) {
      expect(panelBounds.y).toBeLessThan(100);
      if (viewport.width > 640) expect(panelBounds.x + panelBounds.width).toBeGreaterThan(viewport.width - 24);
    }
    await expect(panel.getByText("E2E notification", { exact: true })).toBeVisible();
    await panel.getByRole("button", { name: "Clear all", exact: true }).click();
    await expect(panel.getByText("You’re all caught up", { exact: true })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Notifications cleared" })).toHaveCount(0);
  });

  test("Rank front and back controls keep one body view active", async ({ page }) => {
    await signIn(page);
    await page
      .getByRole("navigation", { name: /Primary pages/ })
      .getByRole("button", { name: "Rank", exact: true })
      .click();
    await expect(page.locator(".rank-screen")).toBeVisible();
    const map = page.locator(".rank-body-map-shell");
    await page.getByRole("tab", { name: "Back" }).click();
    await expect(map).toHaveAttribute("data-active-side", "back");
    await expect(page.locator("#front-view")).toHaveAttribute("aria-hidden", "true");
    await expect(page.getByRole("tab", { name: "Back" })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "Front" }).click();
    await expect(map).toHaveAttribute("data-active-side", "front");
    await expect(page.locator("#back-view")).toHaveAttribute("aria-hidden", "true");
  });

  test("calendar backward navigation uses the same transition contract", async ({ page }) => {
    await signIn(page);
    await page
      .getByRole("navigation", { name: /Primary pages/ })
      .getByRole("button", { name: "Calendar", exact: true })
      .click();
    await expect(page.locator(".calendar-screen")).toBeVisible();
    const stage = page.locator(".calendar-month-stage");
    await page.getByRole("button", { name: "Previous month" }).click();
    await expect(stage).toHaveClass(/previous/);
    await expect(page.locator(".calendar-month-stage.previous")).toHaveCount(1);
  });

  test("long workout scrolling leaves the bottom navigation clear", async ({ page }) => {
    await signIn(page);
    const workout = page.locator(".workout-page");
    await expect(workout).toBeVisible();
    const taskCount = await workout.locator(".task").count();
    test.skip(taskCount < 8, "The protected fixture needs a longer split for scroll coverage.");
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    const clearance = await page.evaluate(() => {
      const dock = document.querySelector<HTMLElement>(".bottom-tab-bar");
      const lastCard = [...document.querySelectorAll<HTMLElement>(".workout-page .task")].at(-1);
      if (!dock || !lastCard) return null;
      const dockRect = dock.getBoundingClientRect();
      const cardRect = lastCard.getBoundingClientRect();
      return { cardBottom: cardRect.bottom, dockTop: dockRect.top };
    });
    expect(clearance).not.toBeNull();
    expect(clearance?.cardBottom ?? 0).toBeLessThanOrEqual((clearance?.dockTop ?? 0) + 2);
  });

  test("mouse and trackpad swipes reveal set deletion without changing its values", async ({ page }) => {
    await signIn(page);
    const row = page.locator(".workout-page .set-row:not(.set-heading)").first();
    test.skip((await row.count()) === 0, "The protected fixture needs at least one logged set for swipe coverage.");
    const reps = row.getByLabel(/reps$/i);
    const rir = row.getByLabel(/RIR$/i);
    const before = { reps: await reps.inputValue(), rir: await rir.inputValue() };
    const deleteButton = row.getByRole("button", { name: /Delete .* set/i });
    await expect(deleteButton).toBeHidden();
    const bounds = await row.boundingBox();
    expect(bounds).not.toBeNull();
    if (!bounds) return;
    const startX = bounds.x + 10;
    const y = bounds.y + bounds.height / 2;
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(startX - 72, y, { steps: 4 });
    await page.mouse.up();
    await expect(row).toHaveClass(/is-delete-revealed/);
    await expect(deleteButton).toBeVisible();
    await expect(reps).toHaveValue(before.reps);
    await expect(rir).toHaveValue(before.rir);
  });

  test("iPad layout keeps controls and labels inside the viewport", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "ipad", "This check runs in the iPad project only.");
    await signIn(page);
    await expect(page.getByRole("navigation", { name: /Primary pages/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page
      .getByRole("navigation", { name: /Primary pages/ })
      .getByRole("button", { name: "Workout", exact: true })
      .click();
    const setRows = page.locator(".workout-page .set-row:not(.set-heading)");
    if (await setRows.count()) {
      await expect(setRows.first().getByLabel(/reps$/i)).toBeVisible();
      await expect(setRows.first().getByLabel(/RIR$/i)).toBeVisible();
    }
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
