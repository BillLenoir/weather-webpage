import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { WeatherWebpageStack } from '../src/weather-stack';

test('stack synthesizes', () => {
  const app = new App();
  const stack = new WeatherWebpageStack(app, 'Test', {
    env: { account: '123456789012', region: 'us-east-1' },
  });

  expect(() => Template.fromStack(stack)).not.toThrow();
});
