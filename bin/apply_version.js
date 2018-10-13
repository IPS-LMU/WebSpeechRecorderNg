var fs=require('fs');
var pkg = JSON.parse(fs.readFileSync('projects/speechrecorderng/package.json', 'utf8'));

/*
var modPkg = JSON.parse(fs.readFileSync('module_package.json', 'utf8'));
modPkg.version=pkg.version;

var newModPkgStr=JSON.stringify(modPkg,null,2);
fs.writeFileSync('module_package.json',newModPkgStr);
*/

var tsCont="export const VERSION='"+pkg.version+"'";

fs.writeFileSync('projects/speechrecorderng/src/lib/spr.module.version.ts',tsCont);

console.log('Applied version: '+pkg.version);

process.exit(0)
