# Publishing to npm

The first successful publication of `opend-cli` assigns that unscoped package name
to the publishing npm account. There is no separate name-reservation step. A 404
from `npm view opend-cli` means no public package is currently visible under that
name, but the name is not secured until `npm publish` succeeds.

Publishing is intentionally a two-stage setup: one authenticated first publish,
then token-free releases from GitHub Actions.

## First publish

1. Create or sign in to an npm account at <https://www.npmjs.com/> and enable
   two-factor authentication.
2. From a trusted terminal, authenticate and confirm the account:

   ```bash
   npm login
   npm whoami
   ```

3. Make sure the intended release commit is on `main`, CI is green, and the
   working tree is clean.
4. Inspect exactly what npm will receive:

   ```bash
   npm publish --dry-run
   ```

   This runs the tests and release checks through `prepublishOnly`. Confirm that
   the file list contains `dist/`, documentation, and examples, but no `.env`,
   credentials, local sessions, or development artifacts.
5. Publish version `0.2.2`:

   ```bash
   npm publish
   ```

   Publication is public and version numbers are permanent. A published version
   cannot be overwritten; fixes require a new version.
6. Verify the public package from a clean directory:

   ```bash
   npm view opend-cli name version dist-tags
   npx opend-cli --version
   ```

## Enable trusted publishing

After the package exists, configure its npm package settings with this trusted
publisher:

- Provider: GitHub Actions
- Organization or user: `sudotsu`
- Repository: `opend-ai`
- Workflow filename: `publish.yml`
- Environment name: `npm`
- Allowed action: `npm publish`

Create a GitHub environment named `npm` in the repository settings as well. A
required reviewer is recommended because publishing a package version is not
reversible.

The workflow at `.github/workflows/publish.yml` then authenticates with a
short-lived OIDC identity. It does not need an `NPM_TOKEN` repository secret.

## Later releases

1. Choose a semantic version bump:
   - `patch` for compatible fixes
   - `minor` for compatible new features
   - `major` for breaking changes
2. Update `CHANGELOG.md`, run the release checks, and commit those changes:

   ```bash
   npm test
   npm run test:cli
   npm run check:release
   git add CHANGELOG.md
   git commit -m "Prepare next release"
   ```

3. Let npm update both package files and create the version commit and Git tag:

   ```bash
   npm version patch
   ```

4. Push the commits and tag, then publish a GitHub Release for that exact tag:

   ```bash
   git push origin main --follow-tags
   gh release create vX.Y.Z --verify-tag --generate-notes
   ```

Publishing the non-prerelease GitHub Release triggers the npm workflow. It checks
that the release tag is exactly `v` plus the version in `package.json`, runs the
clean install and guarded publish lifecycle, and publishes with npm provenance.
