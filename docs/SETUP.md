# Setup

How to deploy your own copy of this repository. This assumes you've already done
the "Make it yours" steps in the [README](../README.md): created a repository
from the template and edited `src/config/site.config.ts`,
`src/config/weather.config.ts` and `bootstrap/*.json`.

Placeholders are marked `<like-this>`:

- `<account-id>`: your 12-digit AWS account ID (the `account` in `site.config.ts`)
- `<profile>`: the AWS CLI profile you'll use
- `<owner>/<repo>`: your GitHub repository, e.g. `octocat/weather-webpage`
- `<domain>` and `<subdomain>`: from `site.config.ts`
- `<project-name>`: `projectName` from `site.config.ts`
- `<zone-id>`: the hosted zone's ID

Everything deploys to `us-east-1`; see the README for why.

## Before you start

The stack adds records to an existing Route 53 hosted zone. It doesn't create
the zone. Check three things first, because a problem here causes confusing
failures during the first deploy.

**The hosted zone exists and is public:**

```sh
aws route53 list-hosted-zones --profile <profile> \
  --query "HostedZones[?Name=='<domain>.']"
```

The result should contain one zone with `"PrivateZone": false`. Note its `Id`.

**The zone is the one actually serving your domain's DNS.** A zone can exist in
Route 53 while the domain's registrar points somewhere else. Compare these two
lists of name servers; they should match, though the order may differ:

```sh
dig NS <domain> +short
aws route53 get-hosted-zone --id <zone-id> --profile <profile> \
  --query "DelegationSet.NameServers"
```

**Nothing already uses your subdomain:**

```sh
aws route53 list-resource-record-sets --hosted-zone-id <zone-id> \
  --profile <profile> --query "ResourceRecordSets[?starts_with(Name, '<subdomain>.')]"
```

This should return `[]`. If a record exists, the deploy will fail trying to
create it. Pick a different subdomain or remove the existing record.

## 1. Install dependencies

The project uses Node 22 (`.nvmrc` is included) and npm.

```sh
nvm use            # or install Node 22 however you manage Node versions
npm install
npx projen         # regenerate project files from your edited site.config.ts
npx projen build   # compile, test and synth; should pass before you go further
```

Commit anything these commands change. `.projenrc.ts` reads `site.config.ts`,
so your edits there change generated files such as `package.json` and
`LICENSE`, and CI fails the build if those aren't committed.

If `npx projen` ever fails with `ts-node: command not found`, `node_modules` is
missing. Run `npm install` first.

## 2. Sign in to AWS

You need AWS CLI 2.32.0 or later for `aws login`. Check with `aws --version`.

`aws login` uses your console credentials to create a CLI session that lasts up
to 12 hours, so you don't need long-lived access keys:

```sh
aws login --profile <profile>
aws sts get-caller-identity --profile <profile>
```

The second command should print your `<account-id>`.

- If you sign in to the console as an IAM user, that user needs the
  `SignInLocalDevelopmentAccess` managed policy. Root needs nothing extra.
- If the profile has old `aws_access_key_id` entries in `~/.aws/credentials`,
  remove them. Static keys can take precedence over the login session and cause
  `InvalidClientTokenId` errors.
- If a tool doesn't pick up the session, export it into your shell:

  ```sh
  eval "$(aws configure export-credentials --profile <profile> --format env)"
  ```

The bootstrap step needs admin-level permissions; later deploys need much less.

## 3. Bootstrap CDK

Bootstrapping creates the roles and staging bucket CDK uses to deploy. You do it
once per account and region. If you've used CDK in `us-east-1` before, it may
already be done, and running it again is safe.

```sh
AWS_PROFILE=<profile> npx cdk bootstrap aws://<account-id>/us-east-1
```

Use `npx cdk`, not a global install, so the CLI version matches the project.

Verify:

```sh
aws cloudformation describe-stacks --stack-name CDKToolkit \
  --region us-east-1 --profile <profile> \
  --query "Stacks[0].StackStatus" --output text

aws ssm get-parameter --name /cdk-bootstrap/hnb659fds/version \
  --region us-east-1 --profile <profile> \
  --query "Parameter.Value" --output text

aws iam list-roles --profile <profile> \
  --query "Roles[?starts_with(RoleName, 'cdk-hnb659fds-')].RoleName" --output text
```

Expect `CREATE_COMPLETE` or `UPDATE_COMPLETE`, a version number, and four roles:
`deploy-role`, `file-publishing-role`, `image-publishing-role` and `lookup-role`.

## 4. Create the GitHub OIDC provider

GitHub Actions authenticates to AWS with short-lived OIDC tokens instead of
stored keys. An account can have only one provider for GitHub, so check first:

```sh
aws iam list-open-id-connect-providers --profile <profile>
```

If you see an ARN ending in `oidc-provider/token.actions.githubusercontent.com`,
it already exists. Skip to step 5.

Otherwise, create it in the IAM console: **Identity providers → Add provider →
OpenID Connect**, with:

- Provider URL: `https://token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`

## 5. Create the deploy role

The role GitHub Actions assumes is defined by the two files in `bootstrap/`.
You edited them in "Make it yours". Check them once more before applying them:

- In `trust-policy.json`, the `sub` must be exactly
  `repo:<owner>/<repo>:ref:refs/heads/main`. Match the owner's casing as GitHub
  shows it in the repository URL. The comparison is case-sensitive, and a
  mismatch fails only later, in CI.
- Both files must use your `<account-id>`.

Create the role:

```sh
aws iam create-role --profile <profile> \
  --role-name <project-name>-github-deploy \
  --assume-role-policy-document file://bootstrap/trust-policy.json

aws iam put-role-policy --profile <profile> \
  --role-name <project-name>-github-deploy \
  --policy-name assume-cdk-bootstrap-roles \
  --policy-document file://bootstrap/permissions-policy.json
```

Only workflows running on `main` in your repository can assume the role. Its
only permission is to assume the CDK bootstrap roles, which do the actual
provisioning.

**CDK doesn't manage these files.** If you edit them later, re-apply them:

```sh
aws iam update-assume-role-policy --profile <profile> \
  --role-name <project-name>-github-deploy \
  --policy-document file://bootstrap/trust-policy.json
```

Use `put-role-policy` again for the permissions file. Then read back the live
role to confirm the change, rather than trusting the file:

```sh
aws iam get-role --role-name <project-name>-github-deploy --profile <profile>
```

## 6. Set the repository variable

Copy the role ARN from the `create-role` output. It looks like
`arn:aws:iam::<account-id>:role/<project-name>-github-deploy`.

In your repository, go to **Settings → Secrets and variables → Actions →
Variables** and add:

- Name: `AWS_DEPLOY_ROLE_ARN`
- Value: the role ARN

Add it under **Variables**, not Secrets. The ARN isn't sensitive, and the deploy
workflow reads it as `vars.AWS_DEPLOY_ROLE_ARN`.

## 7. Deploy locally

Deploy once from your machine before relying on CI. Certificate validation and
DNS problems are much easier to diagnose in a terminal than in Actions logs.

```sh
aws login --profile <profile>   # if your session has expired
AWS_PROFILE=<profile> npx projen deploy
```

The first deploy takes several minutes, most of it waiting for the ACM
certificate to validate through DNS and for CloudFront to create the
distribution. When it finishes, `https://<subdomain>.<domain>` should serve the
page within an hour, once the first scheduled fetch has run. Until then it
returns 403, because there's no `index.html` yet. That's expected.

If the deploy fails, CloudFormation rolls back. Check the stack's **Events** tab
in the CloudFormation console for the first failed resource.

## 8. Push to main

Push or merge to `main`. The `deploy` workflow runs `npx projen build`, then
`npx projen deploy`, using the role from step 5.

In the workflow run, check that:

- **`configure-aws-credentials` succeeds.** If it fails with an
  `AssumeRoleWithWebIdentity` error, the trust policy's `sub` doesn't match.
  Check the owner casing and repository name, and that the run came from `main`
  and not another branch.
- **The deploy reports no changes, or only Lambda asset updates.** Your local
  deploy already created the stack, so CI should find nothing else to do. Lambda
  bundles can hash differently on another machine, so a function update on its
  own is harmless. Any other resource change means CI is building a different
  template from yours; usually an uncommitted file.

From now on, every push to `main` deploys.

### Activate the cost allocation tag

Every taggable resource is tagged `project=<project-name>`. To see this
project's costs separately in Cost Explorer, go to **Billing and Cost
Management → Cost allocation tags** and activate `project`.

The tag appears there about a day after the first deploy. Activation applies
only to costs incurred afterwards.

## 9. Protect your branches

This step is optional but recommended. Rulesets aren't copied to repositories
created from a template.

Create one ruleset per branch under **Settings → Rules → Rulesets → New ruleset
→ New branch ruleset**.

For `main`:

1. Name: `main`. Enforcement status: **Active**.
2. Target branches: **Include by pattern**, `main`.
3. Enable **Restrict deletions** and **Block force pushes**.
4. Enable **Require a pull request before merging**. Under **Allowed merge
   methods**, leave only **Merge**.
5. Enable **Require status checks to pass**, and add the `build` check.

For `develop`, do the same, but allow **Squash** as the merge method.

Notes:

- A ruleset can only allow merge methods the repository itself allows. Under
  **Settings → General → Pull Requests**, enable both **Allow merge commits** and
  **Allow squash merging**.
- The `build` check appears in the picker only after the build workflow has run
  at least once, within roughly the last week. If it's missing, open any pull
  request to trigger it, then come back.
- Require `build` only. Projen's workflow also has a `self-mutation` job, which
  runs only when the build changed files. Requiring it would block every clean
  pull request.
- Rulesets are free on public repositories but need a paid plan on private ones.

The merge-method rules enforce the branch model in the README: feature branches
are squash-merged into `develop`, and `develop` is merged into `main` with a
merge commit. Squashing `develop` into `main` would create a commit that
`develop` lacks, and later merges would hit phantom conflicts.

## Troubleshooting

**`NoCredentials` from CDK.** The profile wasn't used. Set `AWS_PROFILE`
explicitly, as in the commands above, rather than relying on your default
profile.

**`InvalidClientTokenId`.** The credentials exist but AWS rejects them. This is
usually stale access keys in `~/.aws/credentials` taking precedence over
`aws login`. Remove them and sign in again.

**`EBADENGINE` warnings.** Your shell isn't on Node 22. Run `nvm use`. If the
warnings come from an editor extension, relaunch the editor from a terminal
that's on Node 22.

**CI fails with "Files were changed during build".** The build rewrote files you
didn't commit, usually because of Prettier formatting. Run `npx projen build`
locally and commit the result. After any change to `.projenrc.ts`, run
`npx projen` and then `npx projen build`, and commit everything both change.

**A pull request is stuck with `build` "Expected — Waiting for status to be
reported".** The build changed files, so projen's `self-mutation` job pushed a
fix commit to your branch. Commits pushed by workflows don't trigger new
workflow runs, so `build` never runs on the new head and the required check
stays pending. Pull the branch and push again; an empty commit is enough:

```sh
git pull
git commit --allow-empty -m "Re-run CI"
git push
```

**`npm ci` fails with a lockfile mismatch.** `package-lock.json` is out of date
with `package.json`. Run `npm install` and commit the updated lockfile.
