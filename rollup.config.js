export default {
  entry: 'dist/module/src/module/index.js',
  dest: 'dist/module/bundles/speechrecorder.umd.js',
  sourceMap: false,
  format: 'umd',
  moduleName: 'ng.speechrecorder',
  globals: {
    '@angular/core': 'ng.core',
    '@angular/common': 'ng.common',
    '@angular/common/http': 'ng.common.http',
    '@angular/material': 'ng.material',
    '@angular/router': 'ng.router',
    'rxjs/Observable': 'Rx',
    'rxjs/ReplaySubject': 'Rx',
    'rxjs/add/operator/map': 'Rx.Observable.prototype',
    'rxjs/add/operator/switchMap': 'Rx.Observable.prototype',
    'rxjs/add/operator/mergeMap': 'Rx.Observable.prototype',
    'rxjs/add/observable/fromEvent': 'Rx.Observable',
    'rxjs/add/observable/of': 'Rx.Observable',
    'rxjs/add/operator/toPromise': 'Rx.Observable.prototype'
  },
  external: [ '@angular/core','@angular/common', '@angular/common/http','@angular/material','@angular/router','rxjs/add/operator/toPromise','rxjs/add/operator/switchMap','util']
}
