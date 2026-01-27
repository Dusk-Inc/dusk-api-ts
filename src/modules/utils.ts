import { z } from "zod";

const envSchema = z.object({
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535),
});

export const parseEnv = () => {
  return envSchema.parse(process.env);
};