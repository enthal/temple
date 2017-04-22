#!/usr/bin/env node

const main = () => {
  log("hi");
}

const log = console.log;

if (require.main === module) {
  main();
}
