const { render, html, css } = require('./tools/ui.js');
const App = require('./App/App.js');

css('./base.css');

render(html`<${App} />`, document.querySelector('#app'));
