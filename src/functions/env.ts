import { z } from "zod";
import type { Response } from "express";

const envSchema = z.object({
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535),
});

export const parseEnv = (): { HOST: string; PORT: number } => {
  return envSchema.parse(process.env);
};

export const sendNotImplemented = (res: Response): void => {
  res.status(501).json({
    error: {
      code: "NOT_IMPLEMENTED",
      message: "Not implemented.",
    },
  });
};

