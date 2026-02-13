import {
  SERVICE_DECORATOR_PHASE,
  SERVICE_DECORATOR_SAFE_ERROR_MESSAGE,
  SERVICE_DECORATOR_TRANSFORM_ERROR_CODE,
} from "../tokens";
import type {
  ServiceDecoratorConfig,
  ServiceDecoratorRule,
} from "../contracts";
import type {
  ServiceDecoratorPhase,
  ServiceMapperContext,
  ServiceDecoratorTransformErrorInput,
} from "../contracts";

export { SERVICE_DECORATOR_PHASE } from "../tokens";
export type {
  ServiceDecoratorConfig,
  ServiceDecoratorRule,
} from "../contracts";
export type { ServiceDecoratorPhase, ServiceMapperContext } from "../contracts";

export class ServiceDecoratorTransformError extends Error {
  readonly code = SERVICE_DECORATOR_TRANSFORM_ERROR_CODE;
  readonly phase: ServiceDecoratorPhase;
  readonly target: string;

  constructor(input: ServiceDecoratorTransformErrorInput) {
    super(input.message);
    this.name = "ServiceDecoratorTransformError";
    this.phase = input.phase;
    this.target = input.target;
  }
}

export class ServiceDecorator<TService extends object> {
  private readonly service: TService;
  private readonly serviceName: string;
  private readonly rules: ServiceDecoratorRule[];

  constructor(service: TService, config: ServiceDecoratorConfig) {
    this.service = service;
    this.serviceName = config.serviceName ?? "service";
    this.rules = config.rules;
  }

  decorate(): TService {
    return new Proxy(this.service, {
      get: (target, propertyKey, receiver) => {
        const member = Reflect.get(target, propertyKey, receiver);
        if (typeof member !== "function") {
          return member;
        }

        return async (...args: unknown[]) => {
          const methodName = String(propertyKey);
          const mappedArgs = await this.mapCallArgs(args, methodName);
          const result = await member.apply(target, mappedArgs);
          return this.mapCallResult(result, methodName);
        };
      },
    });
  }

  private shouldApplyRule(rule: ServiceDecoratorRule, methodName: string): boolean {
    if (!rule.methods || rule.methods.length === 0) {
      return true;
    }
    return rule.methods.includes(methodName);
  }

  private ensureArgsArray(value: unknown, context: ServiceMapperContext): unknown[] {
    if (Array.isArray(value)) {
      return value;
    }
    throw new ServiceDecoratorTransformError({
      phase: context.phase,
      target: `${context.serviceName}.${context.methodName}`,
      message: SERVICE_DECORATOR_SAFE_ERROR_MESSAGE,
    });
  }

  private wrapTransformError(
    error: unknown,
    context: ServiceMapperContext
  ): ServiceDecoratorTransformError {
    if (error instanceof ServiceDecoratorTransformError) {
      return error;
    }
    return new ServiceDecoratorTransformError({
      phase: context.phase,
      target: `${context.serviceName}.${context.methodName}`,
      message: SERVICE_DECORATOR_SAFE_ERROR_MESSAGE,
    });
  }

  private async mapCallArgs(args: unknown[], methodName: string): Promise<unknown[]> {
    let nextArgs = args;

    for (const rule of this.rules) {
      if (!this.shouldApplyRule(rule, methodName) || !rule.mapArgs) {
        continue;
      }

      const context: ServiceMapperContext = {
        serviceName: this.serviceName,
        methodName,
        phase: SERVICE_DECORATOR_PHASE.Encode,
      };

      try {
        const mapped = await rule.mapArgs(nextArgs, context);
        nextArgs = this.ensureArgsArray(mapped, context);
      } catch (error) {
        throw this.wrapTransformError(error, context);
      }
    }

    return nextArgs;
  }

  private async mapCallResult(result: unknown, methodName: string): Promise<unknown> {
    let nextResult = result;

    for (const rule of this.rules) {
      if (!this.shouldApplyRule(rule, methodName) || !rule.mapResult) {
        continue;
      }

      const context: ServiceMapperContext = {
        serviceName: this.serviceName,
        methodName,
        phase: SERVICE_DECORATOR_PHASE.Decode,
      };

      try {
        nextResult = await rule.mapResult(nextResult, context);
      } catch (error) {
        throw this.wrapTransformError(error, context);
      }
    }

    return nextResult;
  }
}
