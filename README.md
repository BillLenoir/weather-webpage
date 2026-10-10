# Weather Webpage

A small, self-hosted weather site for a few locations you care about. A scheduled AWS Lambda fetches the forecast, a second Lambda renders it to plain HTML, and CloudFront serves the result from your own subdomain. One deployment can serve several pages. It's built to be cheap and easy to fork for your own locations.

<!-- ![Screenshot](docs/screenshot.png) -->

## How it works

```
EventBridge Scheduler (hourly by default)
  → fetcher Lambda   — calls the weather provider, normalizes to a Snapshot
  → S3 data bucket   — latest.json + timestamped history copy
  → renderer Lambda  — triggered by the S3 event, renders one page per entry in `pages`
  → S3 site bucket   — <slug>/index.html + a root index
  → CloudFront       — served at https://<subdomain>.<your-domain>/<slug>/
```

Locations shared between pages are fetched once. The pages have no client-side JavaScript; they reload themselves with a `meta refresh` tied to the fetch interval. If a fetch fails, nothing is written. The previous pages stay up, and their timestamps show that they're stale: each location shows when its weather was observed, and the footer shows when the page was last built.

Why it works this way — the data model, the presentation rules and the failure design — is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Read that before changing anything in `src/`.

Weather data comes from [Open-Meteo](https://open-meteo.com/), which doesn't need an API key. Its free API is for non-commercial use; check [their terms](https://open-meteo.com/en/terms) before deploying your own copy.

## Prerequisites

- An AWS account with a **public Route 53 hosted zone** for your domain. The stack adds records to the zone but never creates or deletes it.
- Node 22 (`.nvmrc` is included).
- AWS CLI 2.32 or later, for `aws login`.
- A GitHub account.

## Make it yours

1. Click **Use this template** on GitHub to create your own repository.
2. Edit `src/config/site.config.ts` and set your AWS account ID, domain (the hosted zone name), subdomain, project name and `copyrightOwner`. The project name is used as the cost allocation tag; see [Cost](#cost).
3. Edit `src/config/weather.config.ts`. Set the fetch interval, then one entry per page: its `slug` (the URL path), `title`, locations (label, latitude, longitude), units, which current conditions to show and the number of forecast days.
4. Edit `bootstrap/trust-policy.json` and `bootstrap/permissions-policy.json`. Replace the account ID and the `repo:<owner>/<repo>` subject with your own.

The region is fixed to `us-east-1`; see [Region](#region).

## Deploy

A repository created from the template doesn't inherit this one's GitHub settings (rulesets, Actions variables) or anything in AWS. These steps set those up. Each is described in full in [docs/SETUP.md](docs/SETUP.md).

1. [Install dependencies](docs/SETUP.md#1-install-dependencies): `npm install`, then `npx projen` and `npx projen build`. Commit anything they change.
2. [Sign in to AWS](docs/SETUP.md#2-sign-in-to-aws): `aws login --profile <profile>`
3. [Bootstrap CDK](docs/SETUP.md#3-bootstrap-cdk): `AWS_PROFILE=<profile> npx cdk bootstrap aws://<account>/us-east-1`
4. [Create the GitHub OIDC provider](docs/SETUP.md#4-create-the-github-oidc-provider) if your account doesn't already have one.
5. [Create the deploy role](docs/SETUP.md#5-create-the-deploy-role) from `bootstrap/*.json` with the AWS CLI. CDK does not manage these files, so editing them has no effect until you re-apply them.
6. [Set the repository variable](docs/SETUP.md#6-set-the-repository-variable): `AWS_DEPLOY_ROLE_ARN` = the role's ARN.
7. [Deploy locally once](docs/SETUP.md#7-deploy-locally): `AWS_PROFILE=<profile> npx projen deploy`
8. [Push to `main`](docs/SETUP.md#8-push-to-main). From then on, the GitHub Actions `deploy` workflow builds and deploys on every push to `main`.
9. Optional: [protect your branches](docs/SETUP.md#9-protect-your-branches) with rulesets on `main` and `develop` that require the CI checks and enforce the merge methods described in [Branches](#branches).

The deploy role trusts only `refs/heads/main` of your repository. Its only permission is to assume the CDK bootstrap roles.

Pages are public to anyone who knows the URL and search engines (unless you add a reobots.txt file to restrict indexing). Adding or changing a page means editing the config and deploying, so pages you host for other people are yours to maintain.

## Region

Everything deploys to `us-east-1` because CloudFront only accepts ACM certificates issued in that region. Keeping the whole stack in one region avoids a cross-region certificate setup.

This doesn't slow the pages down for visitors. Most requests are served from CloudFront's edge caches worldwide. The origin in `us-east-1` is contacted roughly once per cache period, which is five minutes (set by the `Cache-Control` header the renderer writes on each page). The Lambdas run on a schedule, not when someone loads a page, so where they run has no effect on page load time.

## Cost

Expect a few cents a month, since usage is well within the free tier or close to it for Lambda, S3 and CloudFront. The Route 53 hosted zone costs $0.50/month and is billed separately from this stack.

Every taggable resource in the stack is tagged `project=<projectName>`, using the project name from `site.config.ts`. To see this project's cost separately in Cost Explorer, activate `project` under **Billing and Cost Management → Cost allocation tags**. The tag shows up there about a day after the first deploy, and applies only to costs incurred after you activate it.

## Development

```sh
npx projen build          # compile, test, synth
npx projen test           # tests only
npx projen deploy         # deploy with your current AWS credentials
npx projen fetch:once     # fetch live weather and print the Snapshot
npx projen fetch:fixture  # the same, saved to tmp/snapshot.json
```

This is a [projen](https://projen.io/) project. Don't hand-edit a generated file: `.gitattributes` lists them all, each marked `linguist-generated` — among them `package.json`, `tsconfig*.json`, the eslint config, `.github/workflows/*`, the pull request template, `.gitignore` and `LICENSE`, plus the generated `*-function.ts` files. Change `.projenrc.ts` instead and run `npx projen`, then `npx projen build`, and commit everything both commands change; CI fails the build if it produces uncommitted changes.

Tests use Jest and cover the pure functions: provider adapters against recorded responses in `test/fixtures`, and rendering against Snapshot fixtures derived from those recordings. The Lambda handlers are kept thin and aren't tested. See [Testing](docs/ARCHITECTURE.md#testing) for what the renderer tests assert and why.

### Branches

- Work happens on `feature/*` and `fix/*` branches.
- These are merged into `develop` with a merge commit.
- `develop` is merged into `main` with a merge commit. Never squash: it rewrites commits the other branch already has.
- The build workflow runs on every PR and on every push to `develop`.
- Pushing to `main` deploys.

## License

[MIT](LICENSE)
