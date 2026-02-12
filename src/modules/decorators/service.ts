export const SERVICE_DECORATOR_PHASE = {
  Encode: "encode",
  Decode: "decode",
} as const;

export type ServiceDecoratorPhase =
  (typeof SERVICE_DECORATOR_PHASE)[keyof typeof SERVICE_DECORATOR_PHASE];

export class ServiceDecoratorTransformError extends Error {
  readonly code = "SERVICE_DECORATOR_TRANSFORM_ERROR";
  readonly phase: ServiceDecoratorPhase;
  readonly target: string;

  constructor(input: { phase: ServiceDecoratorPhase; target: string; message: string }) {
    super(input.message);
    this.name = "ServiceDecoratorTransformError";
    this.phase = input.phase;
    this.target = input.target;
  }
}

export type ServiceMapperContext = {
  serviceName: string;
  methodName: string;
  phase: ServiceDecoratorPhase;
};

export type ServiceArgsMapper = (
  args: unknown[],
  context: ServiceMapperContext
) => unknown[] | Promise<unknown[]>;

export type ServiceResultMapper = (
  result: unknown,
  context: ServiceMapperContext
) => unknown | Promise<unknown>;

export type ServiceDecoratorRule = {
  methods?: string[];
  mapArgs?: ServiceArgsMapper;
  mapResult?: ServiceResultMapper;
};

export type ServiceDecoratorConfig = {
  serviceName?: string;
  rules: ServiceDecoratorRule[];
};

const safeErrorMessage = "Data transform failed.";

const shouldApplyRule = (rule: ServiceDecoratorRule, methodName: string): boolean => {
  if (!rule.methods || rule.methods.length === 0) {
    return true;
  }
  return rule.methods.includes(methodName);
};

const ensureArgsArray = (
  value: unknown,
  context: ServiceMapperContext
): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }
  throw new ServiceDecoratorTransformError({
    phase: context.phase,
    target: `${context.serviceName}.${context.methodName}`,
    message: safeErrorMessage,
  });
};

const wrapTransformError = (
  error: unknown,
  context: ServiceMapperContext
): ServiceDecoratorTransformError => {
  if (error instanceof ServiceDecoratorTransformError) {
    return error;
  }
  return new ServiceDecoratorTransformError({
    phase: context.phase,
    target: `${context.serviceName}.${context.methodName}`,
    message: safeErrorMessage,
  });
};

const mapCallArgs = async (
  args: unknown[],
  methodName: string,
  serviceName: string,
  rules: ServiceDecoratorRule[]
): Promise<unknown[]> => {
  let nextArgs = args;

  for (const rule of rules) {
    if (!shouldApplyRule(rule, methodName) || !rule.mapArgs) {
      continue;
    }

    const context: ServiceMapperContext = {
      serviceName,
      methodName,
      phase: SERVICE_DECORATOR_PHASE.Encode,
    };

    try {
      const mapped = await rule.mapArgs(nextArgs, context);
      nextArgs = ensureArgsArray(mapped, context);
    } catch (error) {
      throw wrapTransformError(error, context);
    }
  }

  return nextArgs;
};

const mapCallResult = async (
  result: unknown,
  methodName: string,
  serviceName: string,
  rules: ServiceDecoratorRule[]
): Promise<unknown> => {
  let nextResult = result;

  for (const rule of rules) {
    if (!shouldApplyRule(rule, methodName) || !rule.mapResult) {
      continue;
    }

    const context: ServiceMapperContext = {
      serviceName,
      methodName,
      phase: SERVICE_DECORATOR_PHASE.Decode,
    };

    try {
      nextResult = await rule.mapResult(nextResult, context);
    } catch (error) {
      throw wrapTransformError(error, context);
    }
  }

  return nextResult;
};

export const makeServiceDecorator = <TService extends object>(
  service: TService,
  config: ServiceDecoratorConfig
): TService => {
  const serviceName = config.serviceName ?? "service";
  const rules = config.rules;

  return new Proxy(service, {
    get(target, propertyKey, receiver) {
      const member = Reflect.get(target, propertyKey, receiver);
      if (typeof member !== "function") {
        return member;
      }

      return async (...args: unknown[]) => {
        const methodName = String(propertyKey);
        const mappedArgs = await mapCallArgs(args, methodName, serviceName, rules);
        const result = await member.apply(target, mappedArgs);
        return mapCallResult(result, methodName, serviceName, rules);
      };
    },
  });
};
