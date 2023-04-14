import { join, posix } from "path";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { getBooleanInput, getInput, getMultilineInput, setFailed } from "@actions/core";
import { S3Client, PutObjectCommand, S3 } from "@aws-sdk/client-s3";
import { create as tarCreate } from "tar";
import globby from "globby";

const s3 = new S3({});
// Middleware added to client, applies to all commands.
s3.middlewareStack.add(
    (next) => async (args) => {
        (args.request as any).headers["Transfer-Encoding"] = "gzip";
        const result = await next(args);
        // result.response contains data returned from next middleware.
        return result;
    },
    {
        step: "build",
        name: "addTransferEncodingHeader",
    }
);

// await client.putObject(params);

// const s3 = new S3Client({});


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
            const key = posix.join(prefix, "archive");
            const tarStream = tarCreate({ gzip: true }, uniquePaths);

            const response = await s3.putObject({
                Bucket: bucket,
                Key: key,
                Body: tarStream,
                ContentEncoding: "gzip",
                ContentType: "application/x-compressed",
            });

            if (response.$metadata.httpStatusCode === 200) {
                console.info("Uploaded archive:", "archive.tgz");
            }
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
