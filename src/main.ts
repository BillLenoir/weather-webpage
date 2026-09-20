import { App, Tags } from 'aws-cdk-lib';
import { WeatherWebpageStack } from './weather-stack';

const app = new App();

new WeatherWebpageStack(app, 'WeatherWebpage', {
  env: { account: '770599626613', region: 'us-east-1' },
});

Tags.of(app).add('project', 'weather-webpage');

app.synth();
