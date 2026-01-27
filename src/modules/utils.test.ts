import { parseEnv } from "./utils";

const buildEnv = (overrides: Partial<NodeJS.ProcessEnv> = {}) => {
  return {
    HOST: "127.0.0.1",
    PORT: "3000",
    ...overrides
  };
};

describe("parse_env", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("domain__valid_env__parses_port_and_host", () => {
    process.env = buildEnv();

    const result = parseEnv();

    expect(result).toEqual({ HOST: "127.0.0.1", PORT: 3000 });
  });

  it("boundary__port_min_max__accepts_1_and_65535", () => {
    process.env = buildEnv({ PORT: "1" });
    expect(parseEnv().PORT).toBe(1);

    process.env = buildEnv({ PORT: "65535" });
    expect(parseEnv().PORT).toBe(65535);
  });

  it("complement__port_out_of_range__throws_validation_error", () => {
    process.env = buildEnv({ PORT: "0" });
    expect(() => parseEnv()).toThrow();

    process.env = buildEnv({ PORT: "65536" });
    expect(() => parseEnv()).toThrow();
  });

  it("chaos__port_non_numeric__throws_validation_error", () => {
    process.env = buildEnv({ PORT: "nope" });

    expect(() => parseEnv()).toThrow();
  });

  it("boundary__host_missing__defaults_to_0_0_0_0", () => {
    process.env = buildEnv();
    delete process.env.HOST;

    const result = parseEnv();

    expect(result.HOST).toBe("0.0.0.0");
  });
});
