# Node.js API for shifter

Custom shifter build for ClicRDV needs
  * html templates preprocessing (yui templates micro or handlebars)
  * sass + compass transpiling

Example:

```javascript
var shifter = require('clicrdv-shifter');
var path = 'any_file_in_your_module';
var options = {
  sassSharedPath: '../clicrdv/public/stylesheets/',
  compilers: {
    micro: require('yui/template-micro').Template.Micro,
    handlebars: require('yui/handlebars').Handlebars
  }
}
shifter(path, options, function () {
  // done
});
```
