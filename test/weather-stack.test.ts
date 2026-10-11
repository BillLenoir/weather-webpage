import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { WeatherWebpageStack } from '../src/weather-stack';

// The stack constructor calls validateAndResolve on the real config, so this
// test also fails when src/config/weather.config.ts is invalid — not only when
// something is wrong with the CDK resources.
test('stack synthesizes', () => {
  const app = new App();
  const stack = new WeatherWebpageStack(app, 'Test', {
    env: { account: '123456789012', region: 'us-east-1' },
  });

  expect(() => Template.fromStack(stack)).not.toThrow();
});
