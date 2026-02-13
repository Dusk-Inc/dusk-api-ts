export type ReadinessCheck = () => boolean | Promise<boolean>;

export type HealthRouterConfig = {
  readiness?: ReadinessCheck;
};
