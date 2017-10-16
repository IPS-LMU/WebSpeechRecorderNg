var fs=require('fs');
var pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

console.log(pkg.version);

var modPkg = JSON.parse(fs.readFileSync('module_package.json', 'utf8'));
modPkg.version=pkg.version;

var newModPkgStr=JSON.stringify(modPkg,null,2);
fs.writeFileSync('module_package.json',newModPkgStr);


var tsCont="export const VERSION='"+pkg.version+"'";

fs.writeFileSync('src/module/speechrecorder/spr.module.version.ts',tsCont);

process.exit(0)
