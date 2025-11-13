import * as functions from 'firebase-functions';
import * as sgMail from '@sendgrid/mail';

export const testSendGrid = functions.https.onCall(async (data, context) => {
  try {
    // Set the API key
    const apiKey = functions.config().sendgrid?.api_key;
    if (!apiKey) {
      throw new Error('SendGrid API key not found in configuration');
    }
    
    sgMail.setApiKey(apiKey);
    
    // Test email data
    const testEmail = {
      to: 'phoka@1pwrafrica.com', // Your email for testing
      from: 'noreply@1pwrafrica.com',
      subject: 'SendGrid Test Email',
      text: 'This is a test email to verify SendGrid configuration.',
      html: '<p>This is a test email to verify SendGrid configuration.</p>'
    };
    
    console.log('Attempting to send test email with SendGrid...');
    console.log('API Key format:', apiKey.startsWith('SG.') ? 'Valid format' : 'Invalid format');
    console.log('API Key length:', apiKey.length);
    
    // Send the test email
    const response = await sgMail.send(testEmail);
    
    console.log('SendGrid response:', response);
    
    return {
      success: true,
      message: 'Test email sent successfully',
      response: response[0],
      apiKeyFormat: apiKey.startsWith('SG.') ? 'Valid' : 'Invalid',
      apiKeyLength: apiKey.length
    };
    
  } catch (error) {
    console.error('SendGrid test failed:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      apiKeyFormat: functions.config().sendgrid?.api_key?.startsWith('SG.') ? 'Valid' : 'Invalid',
      apiKeyLength: functions.config().sendgrid?.api_key?.length || 0
    };
  }
});













