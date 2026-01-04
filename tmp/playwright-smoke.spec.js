const { test, expect } = require('@playwright/test');

const baseUrl = 'http://localhost:3001';

test('crm feedback smoke test', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
  });

  await page.goto(`${baseUrl}/login`);

  await page.getByLabel('Email').fill('demo@spaceport.com');
  await page.getByLabel('Password').fill('demo123');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  await page.getByText('No leads yet').waitFor({ timeout: 10000 });

  await page.getByRole('button', { name: 'Brokerages' }).click();
  await page.getByPlaceholder('Brokerage name').fill('Summit Ridge Realty');
  await page.getByRole('button', { name: 'Add Brokerage' }).click();
  await expect(page.getByText('Summit Ridge Realty')).toBeVisible();

  await page.getByRole('button', { name: 'Close brokerage directory' }).click();

  await page.getByRole('button', { name: 'Add Lead' }).click();

  await page.getByLabel('Contact Name').fill('Alex Agent');
  await page.getByLabel('Company').fill('Spaceport Realty');

  await page.getByRole('combobox').filter({ hasText: 'No brokerage' }).click();
  await page.getByRole('option', { name: 'Summit Ridge Realty' }).click();

  await page.getByLabel('Add Note').fill('Initial note from QA');
  await page.getByRole('button', { name: 'Add Lead' }).last().click();

  const leadRow = page.getByRole('row', { name: /Alex Agent/ });
  await leadRow.getByRole('button', { name: 'View Details' }).click();
  await expect(page.getByText('Missing')).toBeVisible();

  await page.getByText('Add phone number').click();
  await page.getByRole('textbox').first().fill('555-111-2222');
  await page.keyboard.press('Enter');

  await page.getByText('Add email address').click();
  await page.getByRole('textbox').first().fill('alex.agent@example.com');
  await page.keyboard.press('Enter');

  await page.getByPlaceholder('Enter your note...').fill('Added phone and email details');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('by Demo User').first()).toBeVisible();

  await page.getByRole('button', { name: '2 Weeks' }).click();
  const panelHeader = page.getByRole('heading', { name: 'Lead Details' });
  await panelHeader.locator('..').getByRole('button').last().click();

  await expect(page.getByText('Scheduled Reminders')).toBeVisible();

  const trashButton = leadRow.getByRole('button').filter({ has: page.locator('svg') }).last();
  await trashButton.click();
  await page.getByRole('button', { name: 'Move to Trash' }).click();

  await page.getByText('Trash').first().click();
  await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible();
  await page.getByRole('button', { name: 'Restore' }).click();
  await page.getByText('Trash').first().click();
  await expect(page.getByRole('button', { name: 'Restore' })).toHaveCount(0);
});
