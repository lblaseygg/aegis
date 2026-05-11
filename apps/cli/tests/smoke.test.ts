import { describe, expect, test } from "vitest";

import { APP_NAME } from "../src/lib/constants.js";

describe("constants", () => {
  test("exposes the application name", () => {
    expect(APP_NAME).toBe("Aegis CLI");
  });
});
