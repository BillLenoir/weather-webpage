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

  // Licensing
  license: 'MIT',
  copyrightOwner: site.copyrightOwner,

  // GitHub
  githubOptions: {
    mergify: false, // its squash-merge config conflicts with the branch model
    pullRequestLint: false, // remove to enforce Conventional Commits PR titles
  },
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
});

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
