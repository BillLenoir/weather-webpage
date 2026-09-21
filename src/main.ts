import { App, Tags } from 'aws-cdk-lib';
import { site } from './config/site.config';
import { WeatherWebpageStack } from './weather-stack';

const app = new App();

new WeatherWebpageStack(app, 'WeatherWebpage', {
  env: { account: site.account, region: site.region },
});

Tags.of(app).add('project', site.projectName);

app.synth();
