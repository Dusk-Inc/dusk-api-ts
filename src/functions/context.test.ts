import { getCorrelationId, storage } from "./context.js";

const buildContext = (correlationId: string) => {
  return { correlationId };
};

describe("request_context", () => {
  it("domain__storage_has_context__returns_id", () => {
    const context = buildContext("abc-123");

    storage.run(context, () => {
      expect(getCorrelationId()).toBe("abc-123");
    });
  });

  it("boundary__no_context__returns_no_context", () => {
    expect(getCorrelationId()).toBe("no-context");
  });
});
