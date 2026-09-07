import { expect, test } from './extension';

// The smallest possible smoke: the built extension loads, its background
// service worker registers, and the popup renders. Everything else the smoke
// checks (state seeding, screenshots, migration) builds on this fixture.
test('the built extension loads and the popup renders', async ({ context, extensionId }) => {
  expect(extensionId).toMatch(/^[a-p]{32}$/);
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page).toHaveTitle('Go Comment');
  await expect(page.locator('#root')).not.toBeEmpty();
});
