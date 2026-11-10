/**
 * semantic-release configuration, shared by every published package
 * (run per package through semantic-release-monorepo).
 *
 * Channels:
 * - `master` publishes stable versions to the npm `latest` dist-tag.
 * - `beta`   publishes prereleases (`x.y.z-beta.N`) to the npm `beta` dist-tag,
 *            so `npm i @wapijs/wapi.js` keeps installing the stable line while
 *            `npm i @wapijs/wapi.js@beta` installs the beta.
 *
 * While the packages are on 0.x, breaking changes bump the MINOR version
 * (0.1.x -> 0.2.0), as semver allows for 0.x. Remove the `breaking` rule
 * below when releasing 1.0.0.
 *
 * @type {import('semantic-release').GlobalConfig}
 */
// eslint-disable-next-line no-undef
module.exports = {
  extends: "semantic-release-monorepo",
  branches: ["master", { name: "beta", prerelease: true }],
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "angular",
        releaseRules: [{ breaking: true, release: "minor" }],
      },
    ],
    "@semantic-release/release-notes-generator",
    ["@semantic-release/npm", { npmPublish: true }],
    "@semantic-release/github",
    [
      "@semantic-release/git",
      {
        assets: ["package.json"],
        message:
          "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
  ],
};
