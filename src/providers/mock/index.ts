import { createMockProvider } from "./mockProviderFactory.js";

// One instance per "brand" - all backed by the same simulator, so the demo
// can show a user with Apple Health connected and a teammate with Garmin
// connected, contributing to the same challenge side by side.
export const mockAppleHealth = createMockProvider("apple_health");
export const mockGarmin = createMockProvider("garmin");
export const mockFitbit = createMockProvider("fitbit");
export const mockGoogleHealthConnect = createMockProvider("google_health_connect");

export { createMockProvider };
