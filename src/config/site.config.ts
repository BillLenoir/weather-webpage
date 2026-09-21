export interface SiteConfig {
  account: string;
  region: 'us-east-1';
  domainName: string;
  subdomain: string;
  projectName: string;
}

export const site: SiteConfig = {
  account: '770599626613',
  region: 'us-east-1',
  domainName: 'bill-lenoir.com', // existing Route 53 hosted zone
  subdomain: 'weather',
  projectName: 'weather-webpage',
};
