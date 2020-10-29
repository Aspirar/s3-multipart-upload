const AWS = require('aws-sdk');

const config = require('./config');

const s3 = new AWS.S3();

async function list() {
	const response = await s3.listMultipartUploads({
		Bucket: config.bucketName,
	}).promise();
	console.log(response);
}

list()
	.catch(console.error)
	.then(() => process.exit(0));
