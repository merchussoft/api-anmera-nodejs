const storageService = require('../../src/services/storage.service');

const testDelete = async () => {
  try {
    const url = process.argv[2];
    
    if (!url) {
      console.log('❌ Error: No URL provided');
      console.log('\n📖 Usage:');
      console.log('   node test-supabase-delete.js <file_url>');
      console.log('\n📌 Example:');
      console.log('   node test-supabase-delete.js https://xxxxxxxxxxxxx.supabase.co/storage/v1/object/public/...');
      process.exit(1);
    }

    console.log('📤 ================================================');
    console.log('🗑️  TEST: Supabase S3 Delete');
    console.log('📤 ================================================');
    console.log('\n📋 URL to delete:');
    console.log('   ', url);

    console.log('\n🗑️ Deleting file from Supabase S3...');
    
    const startTime = Date.now();
    
    await storageService.deleteFile(url, 'anmerastore-images');
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n✅ File deleted successfully!');
    console.log('');
    console.log('   📦 URL:', url);
    console.log('   ⏱️  Duration:', duration + 's');

    console.log('\n📤 ================================================');
    console.log('🗑️  TEST COMPLETE');
    console.log('📤 ================================================');

  } catch (error) {
    console.error('\n❌ ERROR during deletion:');
    console.error('   Message:', error.message);
    console.error('\n   Stack trace:');
    console.error(error.stack);
    process.exit(1);
  }
};

testDelete();