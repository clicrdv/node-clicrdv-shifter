'use strict';

var spawn       = require('child_process').spawn;
var path        = require('path');
var fs          = require('fs');
var glob        = require('glob');
var async       = require('async');
var SASS_PATERN = '**/!(_)*.scss';


function YuiModule (path, options) {
  console.log('SHIFTING', path.match(/([^\/]*\/src\/.*)/)[0]);
  this.path = path.match(/.*\/src\/[^\/]*/)[0];
  this.options = options || {};
}


YuiModule.prototype.runShifter = function(cb) {
  // TODO : re-enable lint and find a way to stop css linting only
  spawn('shifter', ['--no-lint', '--no-exec', '--quiet'], {stdio: 'inherit', cwd: this.path}).on('close', function () {
    cb();
  });
};


YuiModule.prototype.compileTemplate = function(templatePath, cb) {
  var filename = path.basename(templatePath);
  var matches = filename.match(/^([^\.]*)(\.(handlebars|erb))?.html$/);

  if (matches === null) {
     return;
  }

  var templateName = matches[1];
  var type         = 'raw';
  var options      = this.options;

  if (matches[2]) {
    type = matches[3];
  }

  var compilers  = {
     raw: function (content) {
        return JSON.stringify(content);
     },

     erb: function (content) {
        return 'Y.Template.Micro.revive(' + options.compilers.micro.precompile(content) + ')';
     },

     handlebars: function (content) {
        /**
         * Handlebar doesn't support precompile on nodejs yet
         */
        return 'Y.Handlebars.template(' + options.compilers.handlebars.precompile(content) + ')';
     }
  };

  console.log('compiling '+filename+' with the '+type+' compiler');

  fs.readFile(templatePath, 'utf8', function(err, data) {
    if (err) {
      throw err;
    }

    var dest = templatePath.replace(filename, templateName) + '.js',
        content = 'Y.namespace(\'templates\')[\'' + templateName + '\'] = ' +
                  compilers[type](data) + ';\n';

    fs.writeFile(dest, content, 'utf8', function (err) {
      if (err) {
        throw err;
      }
      cb();
    });
  });
};


YuiModule.prototype.compileTemplates = function(cb) {
  var tasks = [];
  var module = this;

  glob('templates/*.{handlebars,erb}.html', {cwd: this.path}, function (er, files) {
    files.forEach(function (file) {
      tasks.push(module.compileTemplate.bind(module, module.path + '/' + file));
    });

    async.parallel(tasks, function (err) {
      cb(err);
    });
  });
};


YuiModule.prototype.compileSassFile = function(sassPath, cb){
  var dest = sassPath.replace('.scss', '.css');
  var process = spawn('bundle', [
    'exec', 'sass',
    '--compass',
    '-t', 'expanded',
    this.path + '/' + sassPath, // input
    '-I', this.options.sassSharedPath,
    this.path + '/' + dest // output
  ], {stdio: 'inherit'});

  process.on('close', function () {
    cb();
  });
};


YuiModule.prototype.compileModuleSass = function(cb) {
  var tasks = [];
  var module = this;

  glob(SASS_PATERN, {cwd: this.path}, function (err, files) {
    files.forEach(function (file) {
      tasks.push(module.compileSassFile.bind(module, file));
    });

    async.parallel(tasks, function (err) {
      cb(err);
    });
  });
};


YuiModule.prototype.removeIfExists = function(dest, cb) {
  fs.exists(dest, function (exists) {
    if (exists) {
      fs.unlink(dest, function () {
        cb();
      });
      return;
    }
    cb();
  });
};


YuiModule.prototype.cleanModule = function(cb) {
  var tasks = [
    this.cleanTemplates.bind(this),
    this.cleanSass.bind(this)
  ];

  async.parallel(tasks, function (err) {
    cb(err);
  });
};


YuiModule.prototype.cleanTemplates = function(cb) {
  var module = this;

  glob('templates/*.{handlebars,erb}.html', {cwd: this.path}, function (er, files) {
    var tasks = [];

    files.forEach(function (file) {
      tasks.push(module.removeIfExists.bind(module, module.path + '/' + file.replace(/(\.(handlebars|erb))?.html$/, '.js')));
    });

    async.parallel(tasks, function (err) {
      cb(err);
    });
  });
};


YuiModule.prototype.cleanSass = function(cb) {
  var module = this;

  glob('assets/*.scss', {cwd: this.path}, function (er, files) {
    var tasks = [];

    files.forEach(function (file) {
      tasks.push(module.removeIfExists.bind(module, module.path + '/' + file.replace('.scss', '.css')));
    });

    async.parallel(tasks, function (err) {
      cb(err);
    });
  });
};


YuiModule.prototype.shift = function(cb) {
  var tasks = [
    this.compileTemplates.bind(this),
    this.compileModuleSass.bind(this),
    this.runShifter.bind(this),
    this.cleanModule.bind(this)
  ];

  async.series(tasks, function() {
    if (cb) {
      cb();
    }
  });
};


module.exports = function shift(path, options, cb) {
  var module = new YuiModule(path, options);
  module.shift(function () {
    cb();
  });
}
;
