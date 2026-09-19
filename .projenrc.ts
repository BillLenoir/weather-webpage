import { awscdk } from 'projen';

const project = new awscdk.AwsCdkTypeScriptApp({
  name: 'weather-webpage',
  defaultReleaseBranch: 'main',
  cdkVersion: '2.270.0',
  projenrcTs: true,
  prettier: true,

  lambdaOptions: {
    runtime: awscdk.LambdaRuntime.NODEJS_22_X, // default is older; set explicitly
  },

  requireApproval: awscdk.ApprovalLevel.NEVER, // needed for CI deploy
  release: false,        // it's an app, nothing to publish
  depsUpgrade: false,    // see below

  deps: ['@aws-sdk/client-s3'],
});

project.synth();