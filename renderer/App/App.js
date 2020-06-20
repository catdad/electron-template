const { html, css, useState } = require('../tools/ui.js');

css('./App.css');

function App() {
  const [value, setValue] = useState(0);

  return html`
    <div class=app>
      <p>This is your app</p>
      <div><button onclick=${() => setValue(value + 1)}>I count how many times you click me</button> : ${value}</div>
    </div>
  `;
}

module.exports = App;
