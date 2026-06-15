// @ts-check
/** @type {import("syncpack").RcFile} */
export default {
  $schema: "https://unpkg.com/syncpack@13.0.0/dist/schema.json",
  lintFormatting: false,
  semverGroups: [
    {
      packages: ["apps/*"],
      dependencyTypes: ["prod", "dev"],
      range: "",
      label: "Apps should pin dependencies and devDependencies",
    },
    {
      packages: ["packages/*"],
      dependencyTypes: ["peer"],
      range: "^",
      label: "Packages should use ^ for peerDependencies",
    },
    {
      packages: ["workspace-root"],
      dependencyTypes: ["dev"],
      range: "",
      label: "Workspace root should pin devDependencies",
    },
  ],
  versionGroups: [
    {
      packages: ["**"],
      specifierTypes: ["unsupported"],
      isIgnored: true,
      label:
        "Ignore unsupported specifiers (pnpm catalog versions - these are managed centrally in pnpm-workspace.yaml)",
    },
    {
      packages: ["**"],
      dependencyTypes: ["prod", "dev", "peer"],
      preferVersion: "highestSemver",
      label: "All packages should have single versions across the repository",
    },
  ],
};
