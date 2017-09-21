var fs=require('fs');
var pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

console.log(pkg.version);

var tsCont="export const VERSION='"+pkg.version+"'";
//fs.writeFile('test.json',JSON.stringify(pkg,null,1),function(err){
//    if(err) throw err;
//})

fs.writeFileSync('src/module/speechrecorder/spr.module.version.ts',tsCont);
