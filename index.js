#!/usr/bin/env node
const _ = require('lodash')
const yaml = require('js-yaml');
const fs   = require('fs');
const glob = require('glob');
const Promise = require('bluebird');

Promise.promisifyAll(fs);
const globAsync = Promise.promisify(glob);


const main = () => {
  const content = yaml.safeLoad(fs.readFileSync('./example/content.yml', 'utf8'));
  log(content)

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
        log(templatesByName[o['$t']](o));
      })
    });
}

const log = console.log;

if (require.main === module) {
  main();
}
