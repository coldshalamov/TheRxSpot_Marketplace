/**
 * E2E Test: Consultation Flow
 * 
 * This test verifies consultation request and management flow:
 * 1. Request consultation from product page
 * 2. Complete consultation form
 * 3. View consultation status
 * 4. Cancel consultation
 */

import { test, expect } from '@playwright/test'

test.describe('Consultation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to storefront
    await page.goto('/')
  })

  test('should display consultation request button on product page', async ({ page }) => {
    // Navigate to a product page
    await page.goto('/products/test-product')
    
    // Verify consultation request button is visible
    const consultButton = page.locator('[data-testid="request-consultation-button"]')
    await expect(consultButton).toBeVisible()
  })

  test('should open consultation request form', async ({ page }) => {
    await page.goto('/products/test-product')
    
    // Click consultation request button
    await page.click('[data-testid="request-consultation-button"]')
    
    // Verify consultation form is visible
    const consultForm = page.locator('[data-testid="consultation-form"]')
    await expect(consultForm).toBeVisible()
  })

  test('should submit consultation request', async ({ page }) => {
    await page.goto('/products/test-product')
    await page.click('[data-testid="request-consultation-button"]')
    
    // Fill consultation form
    await page.fill('[data-testid="consultation-symptoms"]', 'Headache and fever')
    await page.fill('[data-testid="consultation-message"]', 'I need medical advice')
    
    // Submit form
    await page.click('[data-testid="submit-consultation-button"]')
    
    // Verify success message
    const successMessage = page.locator('[data-testid="consultation-success"]')
    await expect(successMessage).toBeVisible()
  })

  test('should view consultation status from account', async ({ page }) => {
    // Navigate to consultations page
    await page.goto('/account/consultations')
    
    // Verify consultations list is visible
    const consultList = page.locator('[data-testid="consultations-list"]')
    await expect(consultList).toBeVisible()
  })

  test('should display consultation details', async ({ page }) => {
    await page.goto('/account/consultations/consult-123')
    
    // Verify consultation details are visible
    const consultDetails = page.locator('[data-testid="consultation-details"]')
    await expect(consultDetails).toBeVisible()
  })

  test('should cancel consultation', async ({ page }) => {
    await page.goto('/account/consultations/consult-123')
    
    // Click cancel button
    await page.click('[data-testid="cancel-consultation-button"]')
    
    // Confirm cancellation
    await page.click('[data-testid="confirm-cancellation-button"]')
    
    // Verify cancellation message
    const cancelMessage = page.locator('[data-testid="cancellation-success"]')
    await expect(cancelMessage).toBeVisible()
  })
})
