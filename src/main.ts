import { join, posix } from "path";
import { createReadStream } from "fs";
import { getInput, getMultilineInput, setFailed } from "@actions/core";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import globby from "globby";

async function main() {
    try {
        const bucket = getInput("bucket", { required: true });
        const path = getMultilineInput("path", { required: true });
        const prefix = getInput("prefix");

        const paths = (await Promise.all(path.map((path) => globby(path)))).flat();
        const uniquePaths = Array.from(new Set(paths));

        const s3 = new S3Client({});

        await Promise.all(uniquePaths.map(async (path) => {
            const key = posix.join(prefix, path);
            const filePath = join(process.cwd(), path);
            const stream = createReadStream(filePath);

            const putObjectCommand = new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: stream
            });

            await s3.send(putObjectCommand);

            console.info("Uploaded:", filePath);
        }))
    } catch (err) {
        if (err instanceof Error) setFailed(err);
    }
}

main();
