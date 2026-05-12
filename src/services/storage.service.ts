import { supabase } from '../config/supabase';
import { LoggerService } from '../App/services/logger.service';

class StorageService {
    async uploadFile(file: Express.Multer.File, bucket: string, folder: string = ''): Promise<string> {
        try {
            const timestamp = Date.now();
            const fileExtension = file.originalname.split('.').pop();
            const fileName = `${folder}/${timestamp}-${Math.random().toString(36).substring(7)}.${fileExtension}`.replace(/^\/+/, '');

            await LoggerService.info('STORAGE_UPLOAD_START', `Starting upload: ${fileName}`, { bucket, size: file.size });

            const { data, error } = await supabase.storage
                .from(bucket)
                .upload(fileName, file.buffer, {
                    contentType: file.mimetype,
                    upsert: false
                });

            if (error) {
                await LoggerService.error('STORAGE_UPLOAD_ERROR', `Upload failed: ${error.message}`, { fileName, bucket });
                throw new Error(`Supabase upload failed: ${error.message}`);
            }

            const { data: publicData } = supabase.storage
                .from(bucket)
                .getPublicUrl(fileName);

            await LoggerService.success('STORAGE_UPLOAD_SUCCESS', `File uploaded successfully`, { url: publicData.publicUrl });

            return publicData.publicUrl;
        } catch (error) {
            console.error('Storage Upload Error:', error);
            throw error;
        }
    }

    async deleteFile(url: string, bucket: string): Promise<void> {
        try {
            const path = url.split(`${bucket}/`).pop();
            if (!path) return;

            await LoggerService.info('STORAGE_DELETE_START', `Deleting file: ${path}`, { bucket });

            const { error } = await supabase.storage
                .from(bucket)
                .remove([path]);

            if (error) {
                await LoggerService.error('STORAGE_DELETE_ERROR', `Delete failed: ${error.message}`, { path, bucket });
                throw new Error(`Supabase delete failed: ${error.message}`);
            }

            await LoggerService.success('STORAGE_DELETE_SUCCESS', `File deleted successfully`, { path });
        } catch (error) {
            console.error('Storage Delete Error:', error);
            throw error;
        }
    }
}

export default new StorageService();
