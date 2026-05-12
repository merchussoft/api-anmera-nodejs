import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { LoggerService } from '../App/services/logger.service';

const s3Client = new S3Client({
    region: process.env.AWS_REGION || process.env.SUPABASE_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.SUPABASE_KEY || process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.SUPABASE_ANON_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
    },
    forcePathStyle: true,
    endpoint: process.env.AWS_ENDPOINT || process.env.SUPABASE_ENDPOINT,
});

class S3StorageService {
    async uploadFile(file: Express.Multer.File, bucket: string, folder: string = ''): Promise<string> {
        try {
            const timestamp = Date.now();
            const fileExtension = file.originalname.split('.').pop();
            const fileName = `${folder}/${timestamp}-${Math.random().toString(36).substring(7)}.${fileExtension}`.replace(/^\/+/, '');

            await LoggerService.info('S3_UPLOAD_START', `Starting S3 upload: ${fileName}`, {
                bucket,
                size: file.size,
                fileType: file.mimetype
            });

            const command = new PutObjectCommand({
                Bucket: bucket,
                Key: fileName,
                Body: file.buffer,
                ContentType: file.mimetype,
            });

            await s3Client.send(command);

            // Construir la URL pública. 
            // Para Supabase: https://[project-ref].supabase.co/storage/v1/object/public/[bucket]/[fileName]
            let publicUrl = '';
            const endpoint = process.env.AWS_ENDPOINT || '';

            if (endpoint.includes('supabase.co')) {
                // Transformar endpoint de S3 a endpoint público de Supabase
                // De: https://bibzdwzkwnjnaycfjpzb.storage.supabase.co/storage/v1/s3
                // A:   https://bibzdwzkwnjnaycfjpzb.supabase.co/storage/v1/object/public/anmeraStore/fileName
                const baseSupabaseUrl = endpoint.replace('.storage.supabase.co/storage/v1/s3', '.supabase.co/storage/v1/object/public');
                publicUrl = `${baseSupabaseUrl}/${bucket}/${fileName}`;
            } else {
                // Formato estándar de AWS S3
                publicUrl = `https://${bucket}.s3.amazonaws.com/${fileName}`;
            }


            await LoggerService.success('S3_UPLOAD_SUCCESS', `File uploaded to S3 successfully`, {
                url: publicUrl,
                bucket,
                fileName
            });

            return publicUrl;
        } catch (error) {
            await LoggerService.error('S3_UPLOAD_ERROR', `S3 upload failed`, {
                bucket,
                folder,
                error: error,
            });
            throw new Error(`S3 upload failed: ${error}`);
        }
    }

    async deleteFile(url: string, bucket: string): Promise<void> {
        let pathStr = '';
        try {
            pathStr = url.split(`${bucket}/`).pop() || '';
            if (!pathStr) return;

            await LoggerService.info('S3_DELETE_START', `Deleting S3 file: ${pathStr}`, { bucket });

            const command = new DeleteObjectCommand({
                Bucket: bucket,
                Key: pathStr,
            });

            await s3Client.send(command);

            await LoggerService.success('S3_DELETE_SUCCESS', `S3 file deleted successfully`, {
                path: pathStr,
                bucket
            });
        } catch (error) {
            await LoggerService.error('S3_DELETE_ERROR', `S3 delete failed`, {
                path: pathStr,
                bucket,
                error,
            });
            throw new Error(`S3 delete failed: ${error}`);
        }
    }

}

export default new S3StorageService();