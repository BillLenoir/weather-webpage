import { awscdk } from 'projen';

const project = new awscdk.AwsCdkTypeScriptApp({
  name: 'weather-webpage',
  defaultReleaseBranch: 'main',
  cdkVersion: '2.270.0',
  projenrcTs: true,
  prettier: true,

  buildWorkflowOptions: {
    workflowTriggers: {
      pullRequest: {},
      workflowDispatch: {},
      push: { branches: ['develop'] },
    },
  },


  lambdaOptions: {
    runtime: awscdk.LambdaRuntime.NODEJS_22_X, // default is older; set explicitly
  },

  requireApproval: awscdk.ApprovalLevel.NEVER, // needed for CI deploy
  release: false,        // it's an app, nothing to publish
  depsUpgrade: false,

  deps: ['@aws-sdk/client-s3'],
});

project.synth();