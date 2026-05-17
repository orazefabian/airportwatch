import { test as base } from "@playwright/test";
import { mockDefaultRoutes } from "./api-mocks";

export const test = base.extend<{ apiMocks: void }>({
  apiMocks: [
    async ({ page }, use) => {
      await mockDefaultRoutes(page);
      await use();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
