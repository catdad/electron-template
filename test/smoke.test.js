const { expect } = require('chai');

const { start, stop, environment } = require('./lib/app-provider.js');
const config = require('./lib/config-provider.js');

describe('[smoke tests]', () => {
  const all = async (...promises) => {
    let err;

    await Promise.all(promises.map(p => p.catch(e => {
      err = e;
    })));

    if (err) {
      throw err;
    }
  };

  async function cleanup() {
    const includeLogs = this.currentTest.state === 'failed' || process.env.VERBOSE;

    await all(
      stop(includeLogs),
      config.cleanAll()
    );
  }

  beforeEach(cleanup);
  afterEach(cleanup);

  it('opens the application', async () => {
    const configPath = await config.create({});
    const app = await start(configPath);

    await app.utils.waitForVisible('#app');
    await app.utils.waitForElementCount('p.label', 1);

    expect(await app.utils.getText('#app p.label')).to.include('This is your app');
  });

  it(`shows that the app is runing in "${environment}" mode`, async () => {
    const configPath = await config.create({});
    const app = await start(configPath);

    await app.utils.waitForVisible('#app');
    await app.utils.waitForElementCount('p.environment', 1);

    const envString = `Environment: ${environment === 'production' ? 'Production' : 'Development'}`;

    expect(await app.utils.getText('#app p.environment')).to.equal(envString);
  });

  it('counts when clicking the button', async () => {
    const configPath = await config.create({});
    const app = await start(configPath);

    await app.utils.waitForVisible('.app button');

    // maybe consider using better selectors, but you get the idea
    expect(await app.utils.getText('.app > div > span')).to.equal('0');

    await app.utils.click('.app button');

    expect(await app.utils.getText('.app > div > span')).to.equal('1');
  });

  it('loads the previously counted value', async () => {
    const configPath = await config.create({
      // set any config that matter to your app/test
      counter: 72
    });
    const app = await start(configPath);

    await app.utils.waitForVisible('#app button');

    expect(await app.utils.getText('.app > div > span')).to.equal('72');

    await app.utils.click('.app button');

    expect(await app.utils.getText('.app > div > span')).to.equal('73');
  });
});
