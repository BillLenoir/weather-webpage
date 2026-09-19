import { awscdk } from "projen";
import { JobPermission } from "projen/lib/github/workflows-model";

const project = new awscdk.AwsCdkTypeScriptApp({
  name: "weather-webpage",
  defaultReleaseBranch: "main",
  cdkVersion: "2.270.0",
  projenrcTs: true,
  prettier: true,
  minNodeVersion: "22.0.0",
  workflowNodeVersion: "22",

  buildWorkflowOptions: {
    workflowTriggers: {
      pullRequest: {},
      workflowDispatch: {},
      push: { branches: ["develop"] },
    },
  },

  lambdaOptions: {
    runtime: awscdk.LambdaRuntime.NODEJS_22_X, // default is older; set explicitly
  },

  requireApproval: awscdk.ApprovalLevel.NEVER, // needed for CI deploy
  release: false, // it's an app, nothing to publish
  depsUpgrade: false,

  deps: ["@aws-sdk/client-s3"],
});

const deploy = project.github!.addWorkflow("deploy");
deploy.on({ push: { branches: ["main"] }, workflowDispatch: {} });
deploy.addJobs({
  deploy: {
    runsOn: ["ubuntu-latest"],
    permissions: { idToken: JobPermission.WRITE, contents: JobPermission.READ },
    steps: [
      { uses: "actions/checkout@v4" },
      {
        uses: "actions/setup-node@v4",
        with: { "node-version": "22", cache: "npm" },
      },
      { run: "npm ci" },
      {
        uses: "aws-actions/configure-aws-credentials@v4",
        with: {
          "role-to-assume": "${{ vars.AWS_DEPLOY_ROLE_ARN }}",
          "aws-region": "us-east-1",
        },
      },
      { run: "npx projen deploy" },
    ],
  },
});

project.synth();
