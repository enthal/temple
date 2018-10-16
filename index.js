#!/usr/bin/env node
const fs   = require('fs-extra');
const _ = require('lodash')
const yaml = require('js-yaml');
const Promise = require('bluebird');
const marked = require('marked');

Promise.promisifyAll(fs);

_.templateSettings.interpolate = /<%=([\s\S]+?)%>/g;  // disable ES6 ${...} syntax, which may be used in JS intended for browser

const doExports = () => {
  module.exports.makeRecurse = makeRecurse;
  module.exports.gulp = makeGulpPlugin;
}

const main = () => {
  const program = require('commander');
  const path = require('path');
  const glob = require('glob-all');

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

  const content = loadContent(program.content);

  fs.emptyDirSync(program.out);

  if (program.static) {
    fs.copySync(program.static, program.out);
  }

  const templateFilenames = glob.sync(program.templates + '/**/*');
  const templatesByName = _.fromPairs(_.map(templateFilenames, (f) => {
    const name = getTemplateNameFromFilepath(f);
    return [name, _.template(fs.readFileSync(f, 'utf8'))];  // TODO: async
  }));

  const writeOutputFile = (filepath, text) => fs.outputFileSync(path.join(program.out, filepath), text);

  _.each(content, makeRecurse(templatesByName, writeOutputFile));
}


const makeGulpPlugin = (content, meta={}) => {
  const through = require('through2');
  const Vinyl = require('vinyl');

  if (!content)  throw new Error("You need content!");
  if (_.isString(content)) {
    content = loadContent(content);
  } else
  if (!_.isArray(content)) {
    throw new Error("content must be either a string (yaml filename) or an array (loaded content, as from a yaml file)");
  }

  const templatesByName = {};
  const outputFiles = [];
  return through.obj(
    (file, encoding, callback) => {
      const name = getTemplateNameFromFilepath(file.path);
      templatesByName[name] = _.template(file.contents.toString(encoding));
      callback();
    },
    function (callback) {  // flush
      const generateOutputFile = (filepath, text) => this.push(
        new Vinyl({ path:filepath, contents:Buffer.from(text, 'utf8') }));
      try {
        const recurse = makeRecurse(templatesByName, generateOutputFile)
        _.each(content, x => recurse(x));
        if (recurse.meta.errors) console.warn("GOT ERRORS!")
        callback((recurse.meta.errors && !process.env.DEBUG) && new Error("Got errors, check log (Set $DEBUG to emit errors into output files and finish with success anyway)"));
      } catch (e) {
        callback(e);
      }
    }
  );
}

const loadContent = filename => {
  let os = yaml.safeLoad(fs.readFileSync(filename, 'utf8'));
  if (os == null)     { os = []; }
  if (!_.isArray(os)) { os = [os]; }

  _.each(os, o => {
    // TODO: this is hacky: silently ignored unless at root, no scoping, etc.
    if (o.$globals) {
      _.assign(globalsByName, o.$globals);
    }
  });
  return os;
}

const getTemplateNameFromFilepath = (filepath) =>
  /.*\/([^.]+).*/.exec(filepath)[1];  // TODO: nest template naming (flattening here)


const makeRecurse = (templatesByName, onOutputFile) => {
  const recurse = (os) => {
    const meta = recurse.meta;   // heh
    if (os == null)     { os = []; }
    if (!_.isArray(os)) { os = [os]; }
    // log('recurse', os.length);

    return _.map(os, (o) => {
      let text;

      try {
        if (_.isPlainObject(o)) {
          if (o.$ref) {
            o = globalsByName[o.$ref];
          }

          if (o.$globals) {  // loaded in code above
            return null;  // TODO: this is hacky: silently ignored unless at root, no scoping, etc.
          } else
          if (o.$object) {
            if (o.$t) { throw new Error("object can't have both $object and $t"); }  // TODO: show path into content
            // used for making yaml references
            return null;
          } else
          if (o.$include) {
            return recurse(loadContent(o.$include));
          }

          if (!o.$t) { throw new Error("Content object lacks $t"); }  // TODO: show path into content
          const template = templatesByName[o.$t];
          if (!template) { throw new Error("No template for $t: "+o.$t); }  // TODO: show path into content

          text = template(_.assign({
              $:{ recurse:recurse },
              _:_,
            }, o), {sourceURL:o.$t});

          if (o.$path) {
            onOutputFile(o.$path, text);
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
      } catch(e) {
        text = makeErrorText(e);
        console.error(e);
        if (!meta.errors) meta.errors=[];
        meta.errors.push(e);
      }

      return text;

    }).join('\n');
  }
  recurse.meta = {};
  return recurse;
}

const globalsByName = {};

const makeErrorText = e => `
  <div
    class="x-temple-error"
    style="
      background-color:#a00;
      color:white;
      font-family:monospace;
      font-size=120%;
      padding:10px;
      border: 4px dashed #f33;
      border-radius: 8px;
      "
    >
    ${e}
  </div>`

const log = console.log;

if (require.main === module) {
  main();
} else {
  doExports();
}
