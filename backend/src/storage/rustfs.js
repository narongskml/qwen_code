const S3 = require('aws-sdk/clients/s3');
require('dotenv').config();

class RustFSClient {
  constructor() {
    this.endpoint = process.env.RUSTFS_ENDPOINT || 'http://localhost:8080';
    this.accessKey = process.env.RUSTFS_ACCESS_KEY || 'rustfsadmin';
    this.secretKey = process.env.RUSTFS_SECRET_KEY || 'rustfsadmin123';
    this.bucketReports = process.env.RUSTFS_BUCKET_REPORTS || 'reports';
    this.bucketDocuments = process.env.RUSTFS_BUCKET_DOCUMENTS || 'documents';

    // Configure AWS SDK to work with RustFS (S3-compatible)
    this.s3 = new S3({
      endpoint: this.endpoint,
      accessKeyId: this.accessKey,
      secretAccessKey: this.secretKey,
      s3ForcePathStyle: true, // Required for RustFS/MinIO
      signatureVersion: 'v4',
    });

    console.log(`RustFS client initialized with endpoint: ${this.endpoint}`);
  }

  /**
   * Upload a file to RustFS
   * @param {Buffer} fileBuffer - File content as buffer
   * @param {string} key - Object key (path in bucket)
   * @param {string} bucket - Bucket name (optional, defaults to reports bucket)
   * @param {string} contentType - MIME type of the file
   * @returns {Promise<object>} - Upload result with location and key
   */
  async uploadFile(fileBuffer, key, bucket = this.bucketReports, contentType = 'application/octet-stream') {
    try {
      const params = {
        Bucket: bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      };

      const result = await this.s3.upload(params).promise();
      console.log(`File uploaded successfully: ${result.Location}`);
      
      return {
        success: true,
        location: result.Location,
        key: result.Key,
        bucket: result.Bucket,
        etag: result.ETag,
      };
    } catch (error) {
      console.error('Error uploading file to RustFS:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Download a file from RustFS
   * @param {string} key - Object key
   * @param {string} bucket - Bucket name
   * @returns {Promise<Buffer>} - File content as buffer
   */
  async downloadFile(key, bucket = this.bucketReports) {
    try {
      const params = {
        Bucket: bucket,
        Key: key,
      };

      const result = await this.s3.getObject(params).promise();
      return result.Body;
    } catch (error) {
      console.error('Error downloading file from RustFS:', error);
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  /**
   * Get file metadata from RustFS
   * @param {string} key - Object key
   * @param {string} bucket - Bucket name
   * @returns {Promise<object>} - File metadata
   */
  async getFileMetadata(key, bucket = this.bucketReports) {
    try {
      const params = {
        Bucket: bucket,
        Key: key,
      };

      const result = await this.s3.headObject(params).promise();
      return {
        contentLength: result.ContentLength,
        contentType: result.ContentType,
        lastModified: result.LastModified,
        etag: result.ETag,
      };
    } catch (error) {
      console.error('Error getting file metadata from RustFS:', error);
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }

  /**
   * Delete a file from RustFS
   * @param {string} key - Object key
   * @param {string} bucket - Bucket name
   * @returns {Promise<object>} - Deletion result
   */
  async deleteFile(key, bucket = this.bucketReports) {
    try {
      const params = {
        Bucket: bucket,
        Key: key,
      };

      await this.s3.deleteObject(params).promise();
      console.log(`File deleted successfully: ${key}`);
      
      return {
        success: true,
        key,
        bucket,
      };
    } catch (error) {
      console.error('Error deleting file from RustFS:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * List files in a bucket with optional prefix
   * @param {string} prefix - Optional prefix to filter files
   * @param {string} bucket - Bucket name
   * @returns {Promise<Array>} - List of file objects
   */
  async listFiles(prefix = '', bucket = this.bucketReports) {
    try {
      const params = {
        Bucket: bucket,
        Prefix: prefix,
      };

      const result = await this.s3.listObjectsV2(params).promise();
      return result.Contents.map((obj) => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
        etag: obj.ETag,
      }));
    } catch (error) {
      console.error('Error listing files from RustFS:', error);
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Generate a presigned URL for temporary access
   * @param {string} key - Object key
   * @param {number} expiresIn - Expiration time in seconds
   * @param {string} bucket - Bucket name
   * @returns {string} - Presigned URL
   */
  generatePresignedUrl(key, expiresIn = 3600, bucket = this.bucketReports) {
    const params = {
      Bucket: bucket,
      Key: key,
      Expires: expiresIn,
    };

    return this.s3.getSignedUrl('getObject', params);
  }

  /**
   * Check if a bucket exists, create if it doesn't
   * @param {string} bucket - Bucket name
   * @returns {Promise<boolean>} - Whether bucket exists or was created
   */
  async ensureBucketExists(bucket) {
    try {
      await this.s3.headBucket({ Bucket: bucket }).promise();
      console.log(`Bucket ${bucket} already exists`);
      return true;
    } catch (error) {
      if (error.code === 'NotFound' || error.statusCode === 404) {
        try {
          await this.s3.createBucket({ Bucket: bucket }).promise();
          console.log(`Bucket ${bucket} created successfully`);
          return true;
        } catch (createError) {
          console.error(`Error creating bucket ${bucket}:`, createError);
          throw createError;
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * Initialize storage - ensure required buckets exist
   */
  async initialize() {
    try {
      await this.ensureBucketExists(this.bucketReports);
      await this.ensureBucketExists(this.bucketDocuments);
      console.log('RustFS storage initialized successfully');
    } catch (error) {
      console.error('Error initializing RustFS storage:', error);
      throw error;
    }
  }
}

// Create singleton instance
const rustFS = new RustFSClient();

module.exports = rustFS;
