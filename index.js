#!/usr/bin/env node
const _ = require("lodash");
const oss = require("ali-oss");
var cos = require("cos-nodejs-sdk-v5");
const ora = require("ora");
const parallel = require("p-all");
const globby = require("globby");
const chalk = require("chalk");
const program = require("commander");
const assert = require("assert");
const fs = require("fs");
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

let promisify = (fn, receiver) => {
  return (...args) => {
    return new Promise((resolve, reject) => {
      fn.apply(receiver, [
        ...args,
        (err, res) => {
          return err ? reject(err) : resolve(res);
        }
      ]);
    });
  };
};

program
  .option(
    "-c, --config <config>",
    "阿里OSS或腾讯COS配置参数，json结尾文件",
    "./ossconfig.json"
  )
  .option("-t, --type <type>", "value: oss | cos")
  .option(
    "-s, --source <source>",
    "本地要上传的文件所在目录, glob{options.cwd}, default:process.cwd()"
  )
  .option("-p, --pattern <pattern>", "glod匹配模式, minimatch", "*")
  .option("-d, --destination <destination>", "OSS目的Path")
  .option("-q, --concurrency <concurrency>", "并行任务数", 3);

program.parse(process.argv);

const { config, type, source, pattern, destination, concurrency } = program;

assert.ok(
  config,
  chalk.red("arg config value error. < enter oss-upload-cli -h >")
);
assert.ok(
  type,
  chalk.red("arg type value error. < enter oss-upload-cli -h >  ")
);
assert.ok(
  source,
  chalk.red("arg source value error. < enter oss-upload-cli -h >")
);
assert.ok(
  pattern,
  chalk.red("arg pattern value error. < enter oss-upload-cli -h >")
);
assert.ok(
  destination,
  chalk.red("arg destination value error. < enter oss-upload-cli -h >")
);
assert.ok(
  concurrency,
  chalk.red("arg concurrency value error. < enter oss-upload-cli -h >")
);

osscfgPath = config.startsWith("/") ? config : `${process.cwd()}/${config}`;
sourcePath = source.startsWith("/") ? source : `${process.cwd()}/${source}`;

log.success(osscfgPath, sourcePath, pattern, destination);

const _ossconfig = require(osscfgPath);

const ossconfig = Object.assign(
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
  _ossconfig
);
// log.warn(JSON.stringify(config));

if (
  _.some(
    _.pick(ossconfig, "accessKeyId", "accessKeySecret", "cwd", "pattern"),
    val => typeof val === "undefined"
  )
) {
  throw new Error("invalid config");
}

const store =
  type === "oss"
    ? oss(
        _.omitBy(
          _.pick(
            ossconfig,
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
      )
    : new cos({
        SecretId: ossconfig.accessKeyId,
        SecretKey: ossconfig.accessKeySecret
      });

var storePutobject =
  type === "oss" ? store.put : promisify(store.putObject, store);

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
      spinner.start(
        `uploading: ` +
          `${sourcePath}${file}` +
          ` to ${ossconfig.bucket} ${destination}`
      );
      try {
        if (type === "oss") {
          await store.put(`${destination}${file}`, `${sourcePath}${file}`);
        } else if (type === "cos") {
          await storePutobject({
            Bucket: ossconfig.bucket,
            Region: ossconfig.region,
            Key: `${destination}${file}`,
            Body: fs.createReadStream(`${sourcePath}${file}`),
            ContentLength: fs.statSync(`${sourcePath}${file}`).size
          });
        }

        countSuccess++;
        spinner.succeed(chalk.green(`uploading success: ${file}`));
      } catch (error) {
        countFail++;
        spinner.fail(
          chalk.red(`uploading error: ${file}\n  ==> ${JSON.stringify(error)}`)
        );
      }
    }),
    { concurrency: Number.parseInt(concurrency) }
  );

  spinner.info(
    `total ${files.length} files finished, success: ${countSuccess}, fail: ${countFail}`
  );

  return objects;
};

(async function() {
  try {
    await upload(_.pick(ossconfig, "destination", "cwd", "pattern"));
  } catch (error) {
    log.error(error);
  }
})();
