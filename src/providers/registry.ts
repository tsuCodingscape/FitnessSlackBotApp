import type { ActivityProvider } from "./types.js";
import type { ProviderKey } from "../shared/types.js";
import {
  mockAppleHealth,
  mockGarmin,
  mockFitbit,
  mockGoogleHealthConnect,
} from "./mock/index.js";

/**
 * Central place the rest of the app looks up "the provider for this key".
 * Today every key maps to a mock (USE_MOCK_PROVIDERS=true, PRD Section 6/31
 * says start here). To wire up a real integration:
 *
 *   1. Implement ActivityProvider for it (e.g. src/providers/real/fitbit.ts)
 *      handling that provider's actual OAuth2 + API calls.
 *   2. Swap its entry in this map behind the USE_MOCK_PROVIDERS flag.
 *
 * Nothing in the game engine, API, or Slack app needs to change.
 */
const registry: Record<ProviderKey, ActivityProvider> = {
  apple_health: mockAppleHealth,
  garmin: mockGarmin,
  fitbit: mockFitbit,
  google_health_connect: mockGoogleHealthConnect,
  samsung_health: mockGoogleHealthConnect, // no dedicated mock yet; reuse the generic simulator
  oura: mockGoogleHealthConnect,
  manual: mockGoogleHealthConnect,
  mock: mockGoogleHealthConnect,
};

export function getProvider(key: ProviderKey): ActivityProvider {
  const provider = registry[key];
  if (!provider) throw new Error(`No activity provider registered for "${key}"`);
  return provider;
}
