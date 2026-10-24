export function mongoDatabaseName(nodeEnv: string | undefined): "prod" | "test" {
  return nodeEnv === "production" ? "prod" : "test";
}
