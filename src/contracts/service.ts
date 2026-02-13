export type ServiceDecoratorPhase = "encode" | "decode";

export type ServiceDecoratorTransformErrorInput = {
  phase: ServiceDecoratorPhase;
  target: string;
  message: string;
};

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
