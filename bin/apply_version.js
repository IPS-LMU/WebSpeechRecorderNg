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

// The FILES-mode fixture the editor reads where a deployment would answer `GET version` (its development
// `apiEndPoint` is `test`). Nothing asserted it against the build, so a release left it claiming the old
// version and the editor's version checks compared against a stale number. Written the way the file is
// formatted — two-space JSON and a trailing newline — so running this leaves a current fixture untouched.
fs.writeFileSync('src/test/version.json',JSON.stringify({recorderVersion:pkg.version},null,2)+'\n');

console.log('Applied version: '+pkg.version);

process.exit(0)
