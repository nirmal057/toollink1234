import { sendEmail } from './ToolinkBackend/src/utils/emailService.js';

console.log('🧪 Testing ToolLink Email System...\n');

async function testEmailSystem() {
    try {
        console.log('📧 Sending test email...');
        
        const testResult = await sendEmail({
            to: 'test@example.com', // This won't actually be sent, just testing the configuration
            template: 'test-email',
            data: {
                testMessage: 'Email system is working correctly!',
                timestamp: new Date().toLocaleString()
            }
        });

        console.log('✅ Email system test successful!');
        console.log('📝 Test result:', testResult);
        
        return true;
        
    } catch (error) {
        console.error('❌ Email system test failed:');
        console.error('Error details:', error.message);
        
        if (error.code === 'EAUTH') {
            console.log('\n🔐 Authentication Error:');
            console.log('- Check if Gmail App Password is correct');
            console.log('- Verify TOOLLINK_EMAIL environment variable');
            console.log('- Ensure 2-Factor Authentication is enabled on Gmail');
        }
        
        if (error.code === 'ECONNECTION') {
            console.log('\n🌐 Connection Error:');
            console.log('- Check internet connection');
            console.log('- Verify Gmail SMTP settings');
        }
        
        return false;
    }
}

// Run the test
testEmailSystem()
    .then(success => {
        if (success) {
            console.log('\n🎉 Email system is ready for production!');
            console.log('📮 You can now:');
            console.log('   - Send customer welcome emails');
            console.log('   - Reply to customer messages'); 
            console.log('   - Send registration confirmations');
            console.log('   - Send order notifications');
        } else {
            console.log('\n⚠️  Email system needs configuration.');
            console.log('Please check the error details above.');
        }
    })
    .catch(error => {
        console.error('Unexpected error:', error);
    });