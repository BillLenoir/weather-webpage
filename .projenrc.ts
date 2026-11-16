import { awscdk, javascript } from 'projen';
import { JobPermission } from 'projen/lib/github/workflows-model';
import { site } from './src/config/site.config';

const NODE_MAJOR = '22';

const project = new awscdk.AwsCdkTypeScriptApp({
  name: site.projectName,
  defaultReleaseBranch: 'main',
  cdkVersion: '2.270.0',
  projenrcTs: true,

  // Toolchain
  packageManager: javascript.NodePackageManager.NPM,
  minNodeVersion: `${NODE_MAJOR}.0.0`,
  workflowNodeVersion: NODE_MAJOR,
  prettier: true,
  prettierOptions: { settings: { singleQuote: true } },
  tsconfig: {
    compilerOptions: { noUnusedLocals: true, noUnusedParameters: true },
  },

  // Licensing
  license: 'MIT',
  copyrightOwner: site.copyrightOwner,

  // GitHub
  githubOptions: {
    mergify: false, // its squash-merge config conflicts with the branch model
    pullRequestLint: false, // remove to enforce Conventional Commits PR titles
  },
  // .github/pull_request_template.md is generated; edit it here, not there.
  pullRequestTemplateContents: [
    'Fixes #',
    '',
    '- [ ] `npx projen build` passes',
    '- [ ] Generated files (`package.json`, `tsconfig*.json`, `.projen/*`, workflows) are committed alongside the `.projenrc.ts` change that produced them',
    '- [ ] `docs/ARCHITECTURE.md` updated, if this changes a decision or adds one',
  ],
  buildWorkflowOptions: {
    workflowTriggers: {
      pullRequest: {},
      workflowDispatch: {},
      push: { branches: ['develop'] },
    },
  },
  release: false, // an app; nothing to publish
  depsUpgrade: false, // the upgrade workflow needs a PROJEN_GITHUB_TOKEN

  // CDK
  lambdaOptions: {
    runtime: awscdk.LambdaRuntime.NODEJS_22_X, // the default is older
  },
  requireApproval: awscdk.ApprovalLevel.NEVER, // required for unattended CI deploys

  deps: ['@aws-sdk/client-s3', 'zod'],
  // Local preview only, never bundled into a Lambda. Declared rather than run
  // through npx so the task uses a pinned local binary and can't stop to ask
  // whether to install something.
  devDeps: ['serve'],
});

// A CDK app runs from ts-node and jest, so projen leaves `compile` with no
// steps and nothing in the build type-checks src. ts-jest covers what the tests
// import but never emits declarations, which is how a declaration-only error
// (TS4094 on an exported value whose inferred type is an unexported class)
// reaches a green CI. tsconfig.json includes src only; test is covered by
// ts-jest and .projenrc.ts by ts-node at `npx projen`.
project.compileTask.exec('tsc --noEmit -p tsconfig.json');

project.addTask('fetch:once', {
  description: 'Fetch live weather and print the Snapshot',
  exec: 'ts-node src/scripts/fetch-once.ts',
});
// Scratch capture, not a fixture: renderer fixtures are derived from
// test/fixtures/open-meteo.json through toSnapshot, never recorded.
project.addTask('fetch:fixture', {
  description: 'Save live weather as a Snapshot in tmp/snapshot.json',
  exec: 'mkdir -p tmp && ts-node src/scripts/fetch-once.ts > tmp/snapshot.json',
});
project.addTask('render:once', {
  description: 'Render tmp/snapshot.json into tmp/site, laid out as on S3',
  exec: 'ts-node src/scripts/render-once.ts',
});
project.addTask('run:local', {
  description: "Serve tmp/site at localhost, so the root index's links resolve",
  exec: 'serve tmp/site',
});
project.gitignore.exclude('/tmp/');

const deploy = project.github!.addWorkflow('deploy');
deploy.on({ push: { branches: ['main'] }, workflowDispatch: {} });
deploy.addJobs({
  deploy: {
    runsOn: ['ubuntu-latest'],
    // Serialize deploys; never cancel a CloudFormation update midway.
    concurrency: { group: 'deploy', 'cancel-in-progress': false },
    permissions: { idToken: JobPermission.WRITE, contents: JobPermission.READ },
    steps: [
      { uses: 'actions/checkout@v4' },
      {
        uses: 'actions/setup-node@v4',
        with: { 'node-version': NODE_MAJOR, cache: 'npm' },
      },
      { run: 'npm ci' },
      {
        uses: 'aws-actions/configure-aws-credentials@v4',
        with: {
          'role-to-assume': '${{ vars.AWS_DEPLOY_ROLE_ARN }}',
          'aws-region': site.region,
        },
      },
      { run: 'npx projen build' },
      { run: 'npx projen deploy' },
    ],
  },
});

project.gitignore.exclude('CLAUDE.md');
project.synth();
