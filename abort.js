const AWS = require('aws-sdk');

const config = require('./config');

const s3 = new AWS.S3();

async function abort() {
	const listResponse = await s3.listMultipartUploads({
		Bucket: config.bucketName,
	}).promise();
	return Promise.all(listResponse.Uploads.map(upload => (
		s3.abortMultipartUpload({
			Bucket: config.bucketName,
			Key: upload.Key,
			UploadId: upload.UploadId,
		}).promise()
	)))
}

abort()
	.catch(console.error)
	.then(() => console.log('Done'));
