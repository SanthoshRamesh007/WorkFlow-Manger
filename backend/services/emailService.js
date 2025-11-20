const nodemailer = require('nodemailer');

// Create reusable transporter
const createTransporter = () => {
  // Check if email credentials are configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️ Email credentials not configured in .env file');
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail', // or 'outlook', 'yahoo', etc.
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS // Use App Password for Gmail
    }
  });
};

/**
 * Send task assignment notification email
 * @param {Object} options - Email options
 * @param {string} options.assigneeEmail - Email of the person assigned to the task
 * @param {string} options.taskTitle - Title of the task
 * @param {string} options.workspaceName - Name of the workspace
 * @param {string} options.assignedBy - Email of person who assigned the task
 * @param {Date} options.dueDate - Due date of the task (optional)
 */
const sendTaskAssignmentEmail = async (options) => {
  const { assigneeEmail, taskTitle, workspaceName, assignedBy, dueDate } = options;

  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log('📧 Email not sent - transporter not configured');
      return { success: false, error: 'Email service not configured' };
    }

    const dueDateText = dueDate 
      ? `Due Date: ${new Date(dueDate).toLocaleDateString()}`
      : 'No due date specified';

    const mailOptions = {
      from: `"One Cre Workspace" <${process.env.EMAIL_USER}>`,
      to: assigneeEmail,
      subject: `New Task Assignment: ${taskTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">You've been assigned a new task!</h2>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #2196F3;">${taskTitle}</h3>
            <p><strong>Workspace:</strong> ${workspaceName}</p>
            <p><strong>Assigned by:</strong> ${assignedBy}</p>
            <p><strong>${dueDateText}</strong></p>
          </div>
          <p>Log in to your workspace to view details and start working on this task.</p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" 
             style="display: inline-block; background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">
            Go to Dashboard
          </a>
        </div>
      `,
      text: `
        You've been assigned a new task!
        
        Task: ${taskTitle}
        Workspace: ${workspaceName}
        Assigned by: ${assignedBy}
        ${dueDateText}
        
        Log in to your workspace to view details: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard
      `
    };

    console.log('📧 Attempting to send email to:', assigneeEmail);
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', info.messageId);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Test email configuration
 */
const testEmailConfiguration = async (testEmail) => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      return { success: false, error: 'Email credentials not configured' };
    }

    // Verify connection
    await transporter.verify();
    console.log('✅ Email server connection verified');

    // Send test email
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: testEmail || process.env.EMAIL_USER,
      subject: 'One Cre Email Service Test',
      text: 'Email service is configured correctly!'
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email configuration test failed:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendTaskAssignmentEmail,
  testEmailConfiguration
};
