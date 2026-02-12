import {
  makeServiceDecorator,
  SERVICE_DECORATOR_PHASE,
  ServiceDecoratorTransformError,
} from "./service";

describe("service_decorator", () => {
  test("domain__method_rule__maps_args_and_result_for_target_method", async () => {
    const service = {
      async save(input: { secret: string; keep: string }) {
        return {
          ok: true as const,
          payload: input,
        };
      },
      async read() {
        return { ok: true as const };
      },
    };

    const decorated = makeServiceDecorator(service, {
      serviceName: "vault",
      rules: [
        {
          methods: ["save"],
          mapArgs: async (args, context) => {
            expect(context.phase).toBe(SERVICE_DECORATOR_PHASE.Encode);
            expect(context.methodName).toBe("save");
            const first = args[0] as { secret: string; keep: string };
            return [{ ...first, secret: `enc:${first.secret}` }];
          },
          mapResult: async (result, context) => {
            expect(context.phase).toBe(SERVICE_DECORATOR_PHASE.Decode);
            expect(context.methodName).toBe("save");
            const parsed = result as { ok: true; payload: { secret: string; keep: string } };
            return {
              ...parsed,
              payload: { ...parsed.payload, secret: parsed.payload.secret.replace("enc:", "") },
            };
          },
        },
      ],
    });

    const saved = await decorated.save({ secret: "abc", keep: "x" });
    const read = await decorated.read();

    expect(saved).toEqual({
      ok: true,
      payload: { secret: "abc", keep: "x" },
    });
    expect(read).toEqual({ ok: true });
  });

  test("complement__invalid_args_mapper_output__throws_typed_error", async () => {
    const service = {
      async save(input: { secret: string }) {
        return input;
      },
    };

    const decorated = makeServiceDecorator(service, {
      serviceName: "vault",
      rules: [
        {
          mapArgs: async () => ({ invalid: true }) as unknown[],
        },
      ],
    });

    await expect(decorated.save({ secret: "abc" })).rejects.toEqual(
      expect.objectContaining({
        name: "ServiceDecoratorTransformError",
        code: "SERVICE_DECORATOR_TRANSFORM_ERROR",
        phase: SERVICE_DECORATOR_PHASE.Encode,
        target: "vault.save",
        message: "Data transform failed.",
      })
    );
  });

  test("chaos__mapper_throw__wraps_error_without_sensitive_message", async () => {
    const service = {
      async save(input: { secret: string }) {
        return input;
      },
    };

    const decorated = makeServiceDecorator(service, {
      serviceName: "vault",
      rules: [
        {
          mapResult: async () => {
            throw new Error("do not leak raw secret value");
          },
        },
      ],
    });

    await expect(decorated.save({ secret: "abc" })).rejects.toEqual(
      expect.objectContaining({
        name: "ServiceDecoratorTransformError",
        code: "SERVICE_DECORATOR_TRANSFORM_ERROR",
        phase: SERVICE_DECORATOR_PHASE.Decode,
        target: "vault.save",
        message: "Data transform failed.",
      })
    );
  });

  test("boundary__already_typed_error__preserves_original_error", async () => {
    const service = {
      async save(input: { secret: string }) {
        return input;
      },
    };

    const typed = new ServiceDecoratorTransformError({
      phase: SERVICE_DECORATOR_PHASE.Decode,
      target: "vault.save",
      message: "Data transform failed.",
    });

    const decorated = makeServiceDecorator(service, {
      serviceName: "vault",
      rules: [
        {
          mapResult: async () => {
            throw typed;
          },
        },
      ],
    });

    await expect(decorated.save({ secret: "abc" })).rejects.toBe(typed);
  });
});
