import { test, expect } from "@playwright/test"

test.describe("Tenant Resolution", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the homepage
    await page.goto("/")
  })

  test("should resolve tenant by domain", async ({ page }) => {
    // Check that the page loads successfully
    await expect(page).toHaveTitle(/TheRxSpot/)
  })

  test("should show tenant-specific branding", async ({ page }) => {
    // Navigate to a tenant-specific page
    await page.goto("/")
    
    // Check for tenant branding elements
    const branding = page.locator('[data-testid="tenant-branding"]')
    await expect(branding).toBeVisible()
  })

  test("should handle invalid tenant domains", async ({ page }) => {
    // Navigate to an invalid domain
    await page.goto("/invalid-tenant")
    
    // Should show an error page
    await expect(page.locator("h1")).toContainText("Not Found")
  })
})

test.describe("Tenant Resolution", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the homepage
    await page.goto("/")
  })

  test("should resolve tenant by domain", async ({ page }) => {
    // Check that the page loads successfully
    await expect(page).toHaveTitle(/TheRxSpot/)
  })

  test("should show tenant-specific branding", async ({ page }) => {
    // Navigate to a tenant-specific page
    await page.goto("/")
    
    // Check for tenant branding elements
    const branding = page.locator('[data-testid="tenant-branding"]')
    await expect(branding).toBeVisible()
  })

  test("should handle invalid tenant domains", async ({ page }) => {
    // Navigate to an invalid domain
    await page.goto("/invalid-tenant")
    
    // Should show an error page
    await expect(page.locator("h1")).toContainText("Not Found")
  })
})

