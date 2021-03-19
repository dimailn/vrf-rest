// const coffee = require('coffeescript')
// const babelJest = require('babel-jest')

// module.exports = {
//   process: (src, path, config, transformOptions) => {
//     console.log(config)
//     if (coffee.helpers.isCoffee(path)) {
//       coffeeResult = coffee.compile(src, { bare: true })
//       return babelJest.process(coffeeResult, path, config, transformOptions);
//     }
//     if (!/node_modules/.test(path)) {
//       return babelJest.process(src, path);
//     }
//     return src;
//   }
// }


const coffee = require('coffeescript')
const babelJest = require('babel-jest')

module.exports = {
  process: (src, path) => {
    if (coffee.helpers.isCoffee(path)) {
      return coffee.compile(src, { bare: true, transpile: { presets: [['env',       {
        "targets": {
          "node": "current"
        }
      }]]}})
    }
    if (!/node_modules/.test(path)) {
      return babelJest.process(src, path);
    }
    return src;
  }
};