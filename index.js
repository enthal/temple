#!/usr/bin/env node
const fs   = require('fs-extra');
const _ = require('lodash')
const yaml = require('js-yaml');
const glob = require('glob-all');
const Promise = require('bluebird');
const marked = require('marked');
const program = require('commander');
const pretty = require('pretty');

Promise.promisifyAll(fs);

const main = () => {
  program
    .option('-c, --content <path>',   '(REQUIRED) YAML/JSON content file')
    .option('-t, --templates <path>', '(REQUIRED) directory (recursively) containing template files')
    .option('-o, --out <path>',       '(REQUIRED) output directory')
    .option('-s, --static <path>',    '(optional) directory (recursively) containing static files to copy to output directory')
    .parse(process.argv);

  _.each(['content','templates','out'], (x) => {
    if (!program[x]) {
      log(`ERROR: Option required:  --${x}`);
      program.help();  // exits
    }
  });

  const content = yaml.safeLoad(fs.readFileSync(program.content, 'utf8'));  // TODO: async

  fs.emptyDirSync(program.out);

  if (program.static) {
    fs.copySync(program.static, program.out);
  }

  const templateFilenames = glob.sync(program.templates + '/**/*');
  const templatesByName = _.fromPairs(_.map(templateFilenames, (f) => {
    const name = /.*\/([^.]+).*/.exec(f)[1];  // TODO: nest template naming (flattening here)
    return [name,_.template(fs.readFileSync(f, 'utf8'))];  // TODO: async
  }));

  const recurse = (os) => {
    if (os == null)     { os = []; }
    if (!_.isArray(os)) { os = [os]; }

    return _.map(os, (o) => {
      let text;

      if (_.isPlainObject(o)) {
        if (!o.$t) { throw new Error("Content object lacks $t"); }  // TODO: show path into content
        const template = templatesByName[o.$t];
        if (!template) { throw new Error("No template for $t: "+o.$t); }  // TODO: show path into content

        text = template(_.assign({
            $:{ recurse:recurse },
            _:_,
          }, o), {sourceURL:o.$t});

        if (o.$path) {
          fs.outputFileSync(program.out + o.$path, pretty(text, {ocd: true}));
        }
      } else

      if (_.isArray(o)) {
        text = recurse(o);  // flatten nested arrays; TODO really?
      }

      else {
        o = (''+o);
        text = marked(o);
        const m = /^<p>([^]*)<\/p>\n$/ .exec(text);
        if (m && !/<p>/.test(m[1])) {
          // Only 1 wrapping <p>: replace with <span>
          text = `<span>${m[1]}</span>`;
        }
      }

      return text;

    }).join('\n');
  }

  _.each(content, recurse);
}

const log = console.log;

if (require.main === module) {
  main();
}
