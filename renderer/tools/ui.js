const path = require('path');
const cs = require('callsites');

const { h, render, createContext } = require('preact');
const hooks = require('preact/hooks');

const htm = require('htm');
const html = htm.bind(h);

const getVar = (elem, name) => getComputedStyle(elem).getPropertyValue(`--${name}`);
const setVar = (elem, name, value) => elem.style.setProperty(`--${name}`, value);
const getRootVar = (name) => getVar(document.documentElement, name);
const setRootVar = (name, value) => setVar(document.documentElement, name, value);

const css = (csspath, dirname) => {
  const callerFile = cs()[1].getFileName();
  const callerDir = path.dirname(callerFile);

  const link = document.createElement('link');

  Object.assign(link, {
    type: 'text/css',
    rel: 'stylesheet',
    href: path.resolve(dirname || callerDir, csspath)
  });

  document.head.appendChild(link);
};

module.exports = {
  getVar, getRootVar, setVar, setRootVar,
  html, render, css, createContext,
  ...hooks
};
