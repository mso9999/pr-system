import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';

/**
 * Test email functionality by sending a test email to procurement@1pwrafrica.com
 */
export async function sendTestEmail(): Promise<{ success: boolean; message?: string }> {
  try {
    console.log('Sending test email to procurement@1pwrafrica.com...');
    
    // Call the Firebase function to send test email
    const sendTestEmailFunction = httpsCallable(functions, 'sendTestEmail');
    
    const result = await sendTestEmailFunction({
      to: 'procurement@1pwrafrica.com',
      subject: 'Test Email - PR System Notification',
      message: 'This is a test email to verify that the email notification system is working correctly.'
    });
    
    console.log('Test email result:', result.data);
    return { success: true, message: 'Test email sent successfully' };
    
  } catch (error) {
    console.error('Error sending test email:', error);
    return { success: false, message: `Error: ${error}` };
  }
}