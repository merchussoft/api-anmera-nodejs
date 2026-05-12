const storageService = require('../../src/services/storage.service');
const fs = require('fs');
const path = require('path');

const testUpload = async () => {
  try {
    const filePath = process.argv[2];
    
    if (!filePath) {
      console.log('❌ Error: No file path provided');
      console.log('\n📖 Usage:');
      console.log('   node test-supabase-upload.js <image_path>');
      console.log('\n📌 Examples:');
      console.log('   node test-supabase-upload.js ./test-image.jpg');
      console.log('   node test-supabase-upload.js ./tests/evidence-photo.jpg');
      process.exit(1);
    }

    const fullPath = path.resolve(filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.error('❌ File not found:', fullPath);
      process.exit(1);
    }

    const stats = fs.statSync(fullPath);
    const fileSizeKB = (stats.size / 1024).toFixed(2);
    const fileExt = path.extname(fullPath).toLowerCase();
    const fileName = path.basename(fullPath);

    console.log('📤 ================================================');
    console.log('📤 TEST: Supabase S3 Upload');
    console.log('📤 ================================================');
    console.log('\n📄 File Information:');
    console.log('   Name:', fileName);
    console.log('   Path:', fullPath);
    console.log('   Size:', fileSizeKB, 'KB');
    console.log('   Extension:', fileExt || '(unknown)');

    // Validar que sea una imagen
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    if (!validExtensions.includes(fileExt)) {
      console.error('❌ Error: Not a valid image file');
      console.log('   Valid extensions:', validExtensions.join(', '));
      process.exit(1);
    }

    console.log('\n📤 Uploading to Supabase S3...');
    console.log('   Project URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ NOT SET');
    console.log('   Access Key:', process.env.SUPABASE_KEY ? '✅ Set' : '❌ NOT SET');
    console.log('   Secret Key:', process.env.SUPABASE_ANON_KEY ? '✅ Set' : '❌ NOT SET');

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY || !process.env.SUPABASE_ANON_KEY) {
      console.error('\n❌ Error: Supabase credentials not set in .env file');
      console.log('\n📝 Please add these to your .env file:');
      console.log('');
      console.log('SUPABASE_URL=https://your-project.supabase.co');
      console.log('SUPABASE_KEY=your-access-key-id');
      console.log('SUPABASE_ANON_KEY=your-secret-key');
      process.exit(1);
    }

    // Simular req.file de Express
    const file = {
      originalname: fileName,
      buffer: fs.readFileSync(fullPath),
      size: stats.size,
      mimetype: `image/${fileExt.replace('.', '')}`,
    };

    const startTime = Date.now();

    console.log('\n📤 Uploading to bucket...');
    
    const url = await storageService.uploadFile(
      file,
      'delivery-evidence',
      'test-evidence'
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n✅ Upload successful!');
    console.log('');
    console.log('   📦 URL:', url);
    console.log('   ⏱️  Duration:', duration + 's');
    console.log('   📏 Size:', fileSizeKB + 'KB');

    // Verificar que la URL es accesible
    console.log('\n🔍 Checking if URL is accessible...');
    try {
      const fetch = require('node-fetch');
      const response = await fetch(url, { method: 'HEAD' });
      console.log(`   ${response.status === 200 ? '✅' : '⚠️ '} Status:`, response.status, response.statusText);
    } catch (error) {
      console.log('   ⚠️  Could not verify URL (this is expected for private buckets)');
    }

    // Preguntar si desea eliminar el archivo de prueba
    console.log('\n🗑️  Do you want to delete the test file?');
    console.log('   Run: node scripts/test-supabase-delete.js <url>');

    console.log('\n📤 ================================================');
    console.log('📤 TEST COMPLETE');
    console.log('📤 ================================================');

  } catch (error) {
    console.error('\n❌ ERROR during upload:');
    console.error('   Message:', error.message);
    console.error('\n   Stack trace:');
    console.error(error.stack);
    process.exit(1);
  }
};

testUpload();