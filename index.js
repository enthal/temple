#!/usr/bin/env node
const _ = require('lodash')
const yaml = require('js-yaml');
const fs   = require('fs');
const glob = require('glob');
const Promise = require('bluebird');
const mkdirp = require('mkdirp');

Promise.promisifyAll(fs);
const globAsync = Promise.promisify(glob);


const main = () => {
  const content = yaml.safeLoad(fs.readFileSync('./example/content.yml', 'utf8'));
  log(content)

  mkdirp.sync('out');
  const templateDir = './example/templates/'
  globAsync(templateDir+'/**/*')
    .then((filenames)=>{
      // log(filenames);
      const templatesByName = _.fromPairs(_.map(filenames,(f)=>{
        const name = /.*\/([^.]+).*/.exec(f)[1]
        return [name,_.template(fs.readFileSync(f, 'utf8'))];
      }));
      _.each(content, (o)=>{
        log(o);
        const text = templatesByName[o.$t](o);
        if (o.$path) {
          fs.writeFileSync('out/'+o.$path, text);
        }
      })
    });
}

const log = console.log;

if (require.main === module) {
  main();
}
