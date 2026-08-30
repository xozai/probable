import { describe, expect, it } from "vitest";

import { appInfo } from "./app-info";

describe("appInfo", () => {
  it("identifies a ready Probable application", () => {
    expect(appInfo).toEqual({ name: "Probable", status: "ready" });
  });
});
