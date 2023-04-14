import { join, posix } from "path";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { PassThrough } from "stream";
import { getBooleanInput, getInput, getMultilineInput, setFailed } from "@actions/core";
import { S3 } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { pack as tarPack } from "tar-fs";
import globby from "globby";


const s3 = new S3({});

async function main() {
    try {
        const bucket = getInput("bucket", { required: true });
        const path = getMultilineInput("path", { required: true });
        const prefix = getInput("prefix");
        const archive = getBooleanInput("archive");

        const aggregatedPaths = (await Promise.all(path.map((path) => {
            return globby(path, { onlyFiles: false, markDirectories: true });
        }))).flat();

        // Filter out directories that are common prefixes.
        const uniquePaths = Array.from(new Set(aggregatedPaths))
            .filter((a, i, arr) => {
                return a.at(-1) !== "/" || !arr.some((b, j) => i !== j && b.startsWith(a) && b.length > a.length)
            });

        if (archive) {
            const key = posix.join(prefix, "archive.tar");
            const tarStream = tarPack("./", { entries: uniquePaths });

            const upload = new Upload({
                client: s3,
                params: {
                    Bucket: bucket,
                    Key: key,
                    Body: tarStream.pipe(new PassThrough()),
                },
            });

            upload.on("httpUploadProgress", (progress) => {
                console.log(progress);
            });

            await upload.done();

            // const response = await s3.putObject({
            //     Bucket: bucket,
            //     Key: key,
            //     Body: tarStream,
            // });

            // if (response.$metadata.httpStatusCode === 200) {
            //     console.info("Uploaded archive:", "archive.tar");
            // }
        } else {
            await uploadFiles(bucket, prefix, uniquePaths);
        }
    } catch (err) {
        console.log(">>>>>>>>>>ERROR");
        console.log(err);
        if (err instanceof Error) setFailed(err);
    }
}

async function uploadFiles(bucket: string, prefix: string, paths: string[]) {
    let filesUploaded = 0;

    await Promise.all(paths.map(async (path) => {
        const isDir = path.at(-1) === "/";
        const key = posix.join(prefix, path);
        const filePath = join(process.cwd(), path);
        const body = isDir ? undefined : createReadStream(filePath);
        const contentLength = isDir ? undefined : (await stat(filePath)).size;

        const response = await s3.putObject({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentLength: contentLength,
        });

        if (response.$metadata.httpStatusCode === 200) {
            filesUploaded++;
            console.info("Uploaded:", filePath);
        }
    }));

    console.log("### Total files uploaded:", filesUploaded, "###");
}

main();
