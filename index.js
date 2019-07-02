#!/usr/bin/env node
const _ = require("lodash");
const oss = require("ali-oss");
const ora = require("ora");
const parallel = require("p-all");
const globby = require("globby");
const chalk = require("chalk");
const program = require("commander");
const assert = require("assert");
const log = (...msg) => {
  console.log(chalk("oss-upload-cli --> "), ...msg);
};
log.success = (...msg) => {
  log(chalk.green(...msg));
};
log.error = (...msg) => {
  log(chalk.red(...msg));
};
log.warn = (...msg) => {
  log(chalk.keyword("orange")(...msg));
};

program
  .option(
    "-c, --alioss <alioss>",
    "阿里云OSS配置参数，json结尾文件",
    "./aliossconfig.json"
  )
  .option(
    "-s, --source <source>",
    "本地要上传的文件所在目录, glob{options.cwd}, default:process.cwd()"
  )
  .option("-p, --pattern <pattern>", "glod匹配模式, minimatch", "*")
  .option("-d, --destination <destination>", "阿里云OSS目的Path")
  .option("-q, --concurrency <concurrency>", "并行任务数", 3);

program.parse(process.argv);

const { alioss, source, pattern, destination, concurrency } = program;

assert.ok(alioss, chalk.red("arg alioss value error"));
assert.ok(source, chalk.red("arg source value error"));
assert.ok(pattern, chalk.red("arg pattern value error"));
assert.ok(destination, chalk.red("arg destination value error"));
assert.ok(concurrency, chalk.red("arg concurrency value error"));

aliossPath = alioss.startsWith("/") ? alioss : `${process.cwd()}/${alioss}`;
sourcePath = source.startsWith("/") ? source : `${process.cwd()}/${source}`;

log.success(aliossPath, sourcePath, pattern, destination);

const aliossconfig = require(aliossPath);

const config = Object.assign(
  {
    accessKeyId: void 0,
    accessKeySecret: void 0,
    stsToken: void 0,
    bucket: void 0,
    endpoint: void 0,
    region: void 0,
    internal: void 0,
    secure: void 0,
    timeout: void 0,
    cwd: sourcePath,
    pattern: pattern,
    destination: destination
  },
  aliossconfig
);
// log.warn(JSON.stringify(config));

if (
  _.some(
    _.pick(config, "accessKeyId", "accessKeySecret", "cwd", "pattern"),
    val => typeof val === "undefined"
  )
) {
  throw new Error("invalid config");
}

const store = oss(
  _.omitBy(
    _.pick(
      config,
      "accessKeyId",
      "accessKeySecret",
      "stsToken",
      "bucket",
      "endpoint",
      "region",
      "internal",
      "secure",
      "timeout"
    ),
    val => typeof val === "undefined"
  )
);

const upload = async function({ destination, source: cwd, pattern }) {
  let spinner, files, objects;
  spinner = ora({
    text: "uploading"
  });
  files = await globby(pattern, {
    cwd: source,
    nodir: false
  });

  spinner.info(
    `uploading ${files.length} files from ${sourcePath} to ${destination}...`
  );

  let countSuccess = 0,
    countFail = 0;
  objects = await parallel(
    files.map(file => async () => {
      spinner.start(`uploading: ` + file + ` to ${destination}`);
      try {
        await store.put(`${destination}${file}`, `${sourcePath}${file}`);
        countSuccess++;
        spinner.succeed(chalk.green(`uploading success: ${file}`));
      } catch (error) {
        countFail++;
        spinner.fail(chalk.red(`uploading error: ${file}\n  ==> ${error}`));
      }
    }),
    { concurrency: Number.parseInt(concurrency) }
  );

  spinner.info(
    `total ${
      files.length
    } files finished, success: ${countSuccess}, fail: ${countFail}`
  );

  return objects;
};

(async function() {
  try {
    await upload(_.pick(config, "destination", "cwd", "pattern"));
  } catch (error) {
    log.error(error);
  }
})();
