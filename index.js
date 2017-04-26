#!/usr/bin/env node
const _ = require('lodash')
const yaml = require('js-yaml');
const fs   = require('fs');
const glob = require('glob');
const Promise = require('bluebird');
const mkdirp = require('mkdirp');
const marked = require('marked');
const program = require('commander');

Promise.promisifyAll(fs);
const globAsync = Promise.promisify(glob);


const main = () => {
  program
    .option('-c, --content <path>', 'YAML/JSON content file')
    .option('-t, --templates <path>', 'directory (recursively) containing template files')
    .option('-o, --out <path>', 'output directory')
    .parse(process.argv);

  _.each(['content','templates','out'], (x) => {
    if (!program[x]) {
      log(`Option --${x} required.`);
      program.help();  // exits
    }
  });

  const content = yaml.safeLoad(fs.readFileSync(program.content, 'utf8'));
  log(content)

  mkdirp.sync('out');
  globAsync(program.templates + '/**/*')
    .then((filenames)=>{

      const templatesByName = _.fromPairs(_.map(filenames, (f) => {
        const name = /.*\/([^.]+).*/.exec(f)[1]
        return [name,_.template(fs.readFileSync(f, 'utf8'))];
      }));

      const recurse = (os) => {
        if (os == null)     { os = []; }
        if (!_.isArray(os)) { os = [os]; }
        log(os)
        return _.map(os, (o) => {
          let text;
          if (_.isPlainObject(o)) {
            if (!o.$t) { throw new Error("Content object lacks $t:",o); }  // TODO: show path into content
            text = templatesByName[o.$t](_.assign({
                $:{ recurse:recurse },
                _:_,
              }, o), {sourceURL:o.$t});
            if (o.$path) { fs.writeFileSync(program.out + o.$path, text); }
          } else
          if (_.isArray(o)) {
            text = recurse(o);  // flatten nested arrays; TODO really?
          } else {
            o = (''+o);
            text = marked(o);
            if (! ~o.indexOf('\n')) {
              const m = /^<p>(.*)<\/p>\s*$/.exec(text);
              if (m) text = `<span>${m[1]}</span>`;
              log(m,text)
            }
          }
          return text;
        }).join('\n');
      }
      _.each(content, recurse);
    });
}

const log = console.log;

if (require.main === module) {
  main();
}
