const { render, html, css } = require('./tools/ui.js');

css('./base.css');

render(html`This is my app`, document.querySelector('#app'));
