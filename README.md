# oss-upload-cli
![example.gif](example.gif?raw=true)

## Usage


### 1. Install

```shell
npm install -g oss-upload-cli
```

### 2. Example

```shell

# 上传指定文件夹下的文件
oss-upload-cli \
    -c /data/ossconfig/aliossconfig.json \
    -s /data/apk/ \
    -d osspath/test/ \
    -p "*" \
    -q 1

# 上传指定文件夹下的文件，包括子目录
oss-upload-cli \
    -c /data/ossconfig/aliossconfig.json \
    -s /data/apk/ \
    -d osspath/test/ \
    -p "**" \
    -q 1
```

### 3. Help

```shell
oss-upload-cli -h
Usage: oss-upload-cli [options]

Options:
  -c, --alioss <alioss>            阿里云OSS配置参数，json结尾文件 (default: "./aliossconfig.json")
  -s, --source <source>            本地要上传的文件所在目录, glob{options.cwd}, default:process.cwd()
  -p, --pattern <pattern>          glod匹配模式, minimatch (default: "*")
  -d, --destination <destination>  阿里云OSS目的Path
  -q, --concurrency <concurrency>  并行任务数 (default: 3)
  -h, --help                       output usage information
```

```json
阿里云oss配置文件，文件后缀为.json，支持全部参数

{
  "accessKeyId":"",
  "accessKeySecret":"",
  "region":"",
  "bucket":""
}
```
