import { join, posix } from "path";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { getInput, getMultilineInput, setFailed } from "@actions/core";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import globby from "globby";

const s3 = new S3Client({});

async function main() {
    try {
        const bucket = getInput("bucket", { required: true });
        const path = getMultilineInput("path", { required: true });
        const prefix = getInput("prefix");

        const paths = (await Promise.all(path.map((path) => {
            return globby(path, { onlyFiles: false, markDirectories: true });
        }))).flat();

        // Filter out directories that are common prefixes.
        const uniquePaths = Array.from(new Set(paths))
            .filter((a, i, arr) => {
                return a.at(-1) !== "/" || !arr.some((b, j) => i !== j && b.startsWith(a) && b.length > a.length)
            });

        let filesUploaded = 0;

        await Promise.all(uniquePaths.map(async (path) => {
            const isDir = path.at(-1) === "/";
            const key = posix.join(prefix, path);
            const filePath = join(process.cwd(), path);
            const body = isDir ? undefined : createReadStream(filePath);
            const contentLength = isDir ? undefined : (await stat(filePath)).size;

            const putObjectCommand = new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: body,
                ContentLength: contentLength,
            });

            const response = await s3.send(putObjectCommand);

            if (response.$metadata.httpStatusCode === 200) {
                filesUploaded++;
                console.info("Uploaded:", filePath);
            }
        }));

        console.log("### Total files uploaded:", filesUploaded, "###");
    } catch (err) {
        if (err instanceof Error) setFailed(err);
    }
}

main();
