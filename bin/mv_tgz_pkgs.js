var fs=require('fs');
var pkg = JSON.parse(fs.readFileSync('projects/speechrecorderng/package.json', 'utf8'));

var files=fs.readdirSync('dist/speechrecorderng');
for(var i=0;i<files.length;i++){
    var fName=files[i];
    if(fName.match(/^speechrecorderng-.*[.]tgz$/)) {
        fs.renameSync('dist/speechrecorderng/'+fName,'dist/'+fName);
        console.log('Moved: '+fName);
    }
}
process.exit(0)
