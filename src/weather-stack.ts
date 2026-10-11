import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { validateAndResolve } from './config/validate';
import { config } from './config/weather.config';

export class WeatherWebpageStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    // The build-time guard. Nothing in WeatherConfig arrives at runtime, so
    // this is what makes a bad config fail `npx projen build`, CI and
    // `cdk deploy` instead of becoming a Lambda init error after a deploy that
    // reported success. The result is discarded only until there are resources
    // to consume it — the handlers call this again at startup as a backstop.
    // Removing this as redundant removes the only check that runs before deploy.
    validateAndResolve(config);

    // resources go here
  }
}
