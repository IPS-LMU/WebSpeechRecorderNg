var fse = require('fs-extra');

fse.copySync('module_package.json', './dist/module/package.json');