const fs = require('fs');
const AWS = require('aws-sdk');
const axios = require('axios');

const config = require('./config');

const s3 = new AWS.S3({ signatureVersion: 'v4' });

const PART_SIZE = 1024 * 1024 * 5;

function getParts(filePath) {
	const buffer = fs.readFileSync(filePath);

	const bufferSize = Buffer.byteLength(buffer);
	const partCount = Math.ceil(bufferSize / PART_SIZE);

	return Array(partCount).fill().map((val, index) => {
		const start = index * PART_SIZE;
		const end = Math.min(bufferSize, start + PART_SIZE);
		return buffer.slice(start, end);
	});
}

async function createUpload() {
	const response = await s3.createMultipartUpload({
		Bucket: config.bucketName,
		Key: config.destKey,
	}).promise();
	return response.UploadId;
}

function getPresignedUrls(parts, uploadId) {
	return Promise.all(parts.map((part, index) => (
		s3.getSignedUrlPromise('uploadPart', {
			Bucket: config.bucketName,
			Key: config.destKey,
			PartNumber: index + 1,
			UploadId: uploadId,
			Expires: 60,
		})
	)));
}

async function uploadPart(presignedUrl, part, partNumber, tryCount) {
	try {
		const response = await axios.put(presignedUrl, part);
		console.log(`Uploaded part ${partNumber} on try ${tryCount}`);
		return response.headers.etag;
	}
	catch (err) {
		if (tryCount > 10) throw err;
		console.log(`Retry part ${partNumber}, current try count ${tryCount}`);
		return uploadPart(presignedUrl, part, partNumber, tryCount + 1);
	}
}

async function uploadParts(parts, presignedUrls) {
	const arr = [];
	for (const [index, part] of parts.entries()) {
		const etag = await uploadPart(presignedUrls[index], part, index + 1, 1)
		arr.push(etag);
	}
	return arr;
}

function completeUpload(etags, uploadId) {
	return s3.completeMultipartUpload({
		Bucket: config.bucketName,
		Key: config.destKey,
		UploadId: uploadId,
		MultipartUpload: {
			Parts: etags.map((etag, index) => ({
				ETag: etag,
				PartNumber: index + 1
			})),
		},
	}).promise();
}

async function uploadFile(filePath) {
	const parts = getParts(filePath);
	console.log(`Generated ${parts.length} parts`)
	const uploadId = await createUpload();
	console.log(`Created uplaod id ${uploadId}`)
	const presignedUrls = await getPresignedUrls(parts, uploadId);
	console.log('Received presigned urls');
	const etags = await uploadParts(parts, presignedUrls);
	console.log('Uploaded all parts');
	await completeUpload(etags, uploadId);
	console.log('Done');
}

uploadFile(config.filePath)
	.catch(console.error)
	.then(() => process.exit(0));
