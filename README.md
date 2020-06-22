# ⚛ electron template

## Why would I do this?

Well... it's mostly because I couldn't find a started project that I actually wanted to use. The templates and boilerplates and starter apps all seemed to fit into two categories:
* Following the tends: "Say, you like React and Redux and Webpack? I have an Electron starter script for you."
* Bare bones: Handle the minimum amount of code necessary to create a basic Electron app, then leave the user to their own devices.

In both of these cases, the user is barely ready to actually create an app once they have started. They can even create more problems than they solve. So instead, I started down the route and creating Electron applications from scratch. Several applications in, and I am finding that I need to copy paste some code every time I start a new one. This is that code.

It will be very opinionated. If you are offended by opinions that are not your own, this is probably not the template for you. If you are interested in learning more about or discussing these choices, I will be in the [issues section](https://github.com/catdad/electron-template/issues/new).

Now, let's explore it.

## Getting started

Let's get some easy things out of the way first. The very first thing you'll want to do when using this template is to change the name and appropriate data to point to you and your repo. To make it as easy as possible, all app-specific data is kept in `package.json` and this README. You will want to set all appropriate properties in the `package.json` file, such as `name`, `productName`, `appId`, `repository`, `author`, etc.

## Code Build

Right off the bat... there isn't one. And it's a good thing. I'm not going to go into the history of why I hate builds here, but I will just posit taht you don't need one. Electron is the most cutting-edge browser with every latest feature combines with the most recent NodeJS runtime, all rolled into a single environment. If there is something you actually need, it is already there.

## UI Framework

Lack of a code build doesn't keep us from using all new and familiar tools. This template already includes [Preact](https://preactjs.com/) to manage components and [htm](https://www.npmjs.com/package/htm) as a jsx alternative -- see the example in [App.js](renderer/App/App.js). Since it's Electron, you can use CSS [variables](https://css-tricks.com/guides/css-custom-properties/) and [functions](https://css-tricks.com/complete-guide-to-css-functions/). You can even manage CSS at the component leve, with a helper to include the CSS into the page.

## Managing config

While there are some popular ways of handling config (or really any other app-level persistence), they have some problems. Some are not multithread enabled (remember, Electron has 2 threads by default, and a larger app can have many more than that when written well), some are 100% synchronous, and some are both those things. The config module provided in [`lib/config.js`](lib/config.js) is safe to use and ready for production. It's also ready to allow easy testing.

During development, the config file will default to being created in the root directory of your repo, allowing you easy access to it. In production, the config will be created in the user's app data directory.

## IPC

A common problem in Electron apps is needing to communicate between the main and renderer thread. However, [`electron.remote` is considered harmful](https://medium.com/@nornagon/electrons-remote-module-considered-harmful-70d69500f31). This template comes with a wrapper that allows exposing the same Promise-based API to both the main and all renderer threads while keeping your application responsive. See [`lib/isomorphic.js`](lib/isomorphic.js) and an example of how to use it in [`lib/config.js`](lib/config.js). Note that in these cases, all work is delegated to the main thread, keeping the renderer responsive and making this mechanism useful for work that must be done on the main thread anyway.

## Testing

[`spectron`](https://www.npmjs.com/package/spectron) is included for testing, complete with helpers to start and stop the application, provide custom config, and print all logs when a test fails. If you'd like unit tests as well, feel free to add them in any way you'd like (I recommend [`mocha`](https://www.npmjs.com/package/mocha), since it's already used to run the `spectron` tests).

## Installer Build

TODO
