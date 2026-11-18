import { defineRailway, github, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "barberflow";
export default defineRailway(() => {
  const barberflow = service("barberflow", {
    source: github("FADHIL-ux/barberflow", { branch: "main", checkSuites: false }),
    build: { buildCommand: "npm install && npm run build:api", buildEnvironment: "V3", builder: "nixpacks" },
    start: "npm run start:api",
    healthcheck: "/api/health",
    replicas: { "sfo": 1 },
    deploy: { cronSchedule: "0 0 * * *", restartPolicyType: "NEVER" },
  });

  return project("vibrant-amazement", {
    variables: { managed: true },
    resources: [barberflow],
  });
});
