const { get, set } = require('lodash');
const { html, createContext, useEffect, useState } = require('../tools/ui.js');
const toast = require('../tools/toast.js');
const CONFIG = require('../../lib/config.js');

const noop = () => {};

const Config = createContext({});

const withConfig = Component => ({ children, ...props }) => {
  const [localConfig, setLocalConfig] = useState({ __loading: true });

  const api = {
    get: (path, fallback) => get(localConfig, path, fallback),
    set: (path, value) => {
      set(localConfig, path, value);
      CONFIG.setProp(path, value).catch(noop);
    }
  };

  useEffect(() => {
    CONFIG.read().then(obj => {
      delete obj.__loading;
      setLocalConfig(obj);
    }).catch(err => {
      toast.error([
        'failed to load configuration',
        'try restarting the application',
        err.toString()
      ].join('<br/>'), { duration: -1 });
    });
  }, []);

  if (localConfig.__loading) {
    return html`<div></div>`;
  }

  return html`
    <${Config.Provider} value=${api}>
      <${Component} ...${props}>${children}<//>
    <//>
  `;
};

module.exports = { Config, withConfig, CONFIG };
