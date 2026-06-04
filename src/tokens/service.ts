import type { ServiceDecoratorPhase } from "../contracts/index.js";

export const SERVICE_DECORATOR_PHASE = {
  Encode: "encode",
  Decode: "decode",
} as const satisfies Record<string, ServiceDecoratorPhase>;

export const SERVICE_DECORATOR_TRANSFORM_ERROR_CODE = "SERVICE_DECORATOR_TRANSFORM_ERROR";
export const SERVICE_DECORATOR_SAFE_ERROR_MESSAGE = "Data transform failed.";
