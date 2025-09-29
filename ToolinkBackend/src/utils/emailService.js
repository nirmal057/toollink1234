import nodemailer from 'nodemailer';
import logger from './logger.js';

// Create email transporter
const createTransporter = () => {
  // Use Gmail SMTP for ToolLink admin email
  return nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.TOOLLINK_EMAIL || 'toollinksrilanka@gmail.com',
      pass: process.env.TOOLLINK_EMAIL_PASSWORD || 'zjhq nlhb rhjw uqxp'
    },
    tls: {
      rejectUnauthorized: false
    },
    // Add additional configuration for Gmail
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateLimit: 10 // 10 emails per second max
  });
};

const transporter = createTransporter();

// Email templates
const emailTemplates = {
  'email-verification': {
    subject: 'Welcome to ToolLink - Please verify your email',
    html: (data) => `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; color: #333;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">Welcome to ToolLink!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Your account has been created successfully</p>
        </div>

        <div style="padding: 30px; background: white;">
          <h2 style="color: #333; margin-bottom: 20px;">Hello ${data.fullName}!</h2>

          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Thank you for joining ToolLink! We're excited to have you as part of our community.
          </p>

          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            To complete your registration and start using all features, please verify your email address by clicking the button below:
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.verificationUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; display: inline-block;">
              ✅ Verify Email Address
            </a>
          </div>

          <p style="font-size: 14px; color: #666; margin-top: 25px;">
            If the button above doesn't work, copy and paste this link into your browser:<br>
            <a href="${data.verificationUrl}" style="color: #667eea; word-break: break-all;">${data.verificationUrl}</a>
          </p>

          <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
            <h3 style="color: #333; margin-top: 0;">What's Next?</h3>
            <ul style="margin: 0; padding-left: 20px;">
              <li>Verify your email address</li>
              <li>Complete your profile setup</li>
              <li>Explore our services and features</li>
              <li>Start managing your tools and inventory</li>
            </ul>
          </div>
        </div>

        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px;">
          <p style="margin: 0;">If you didn't create this account, please ignore this email.</p>
          <p style="margin: 5px 0 0 0;">© ${new Date().getFullYear()} ToolLink. All rights reserved.</p>
        </div>
      </div>
    `
  },
  'customer-registration-pending': {
    subject: 'Welcome to ToolLink - Registration Received',
    html: (data) => `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; color: #333;">
        <div style="background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">Welcome to ToolLink!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Your registration has been received</p>
        </div>

        <div style="padding: 30px; background: white;">
          <h2 style="color: #333; margin-bottom: 20px;">Hello ${data.fullName}!</h2>

          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Thank you for choosing ToolLink! We've received your customer registration and it's currently being reviewed.
          </p>

          <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #856404; margin-top: 0; display: flex; align-items: center;">
              ⏳ Account Status: Pending Approval
            </h3>
            <p style="color: #856404; margin: 10px 0;">
              Your account is currently under review by our administrators. This process typically takes 1-2 business days.
            </p>
          </div>

          <div style="margin: 25px 0; padding: 20px; background: #f8f9fa; border-radius: 8px;">
            <h3 style="color: #333; margin-top: 0;">Registration Details:</h3>
            <ul style="margin: 10px 0; padding-left: 20px; line-height: 1.8;">
              <li><strong>Email:</strong> ${data.email}</li>
              <li><strong>Full Name:</strong> ${data.fullName}</li>
              <li><strong>Registration Date:</strong> ${new Date(data.submittedAt).toLocaleDateString()}</li>
              <li><strong>Status:</strong> Pending Administrator Approval</li>
            </ul>
          </div>

          <div style="margin: 25px 0; padding: 20px; background: #e8f5e8; border-radius: 8px; border-left: 4px solid #28a745;">
            <h3 style="color: #155724; margin-top: 0;">What happens next?</h3>
            <ol style="margin: 10px 0; padding-left: 20px; line-height: 1.8; color: #155724;">
              <li>Our administrators will review your registration</li>
              <li>You'll receive an email notification once approved</li>
              <li>After approval, you can login and start using ToolLink</li>
              <li>You'll have access to all customer features and services</li>
            </ol>
          </div>

          <p style="font-size: 16px; line-height: 1.6; margin: 25px 0;">
            We appreciate your patience during the approval process. If you have any questions, please don't hesitate to contact our support team.
          </p>
        </div>

        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px;">
          <p style="margin: 0;">Questions? Contact us at support@toollink.com</p>
          <p style="margin: 5px 0 0 0;">© ${new Date().getFullYear()} ToolLink. All rights reserved.</p>
        </div>
      </div>
    `
  },
  'customer-approved': {
    subject: '🎉 Your ToolLink account has been approved!',
    html: (data) => `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; color: #333;">
        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">🎉 Account Approved!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">You can now access your ToolLink account</p>
        </div>

        <div style="padding: 30px; background: white;">
          <h2 style="color: #333; margin-bottom: 20px;">Congratulations ${data.fullName}!</h2>

          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Great news! Your ToolLink customer account has been approved and is now active.
          </p>

          <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #155724; margin-top: 0;">✅ Account Status: Active</h3>
            <p style="color: #155724; margin: 10px 0;">
              You can now login and start using all ToolLink features and services.
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.loginUrl || process.env.FRONTEND_URL + '/auth/login'}" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; display: inline-block;">
              🚀 Login to Your Account
            </a>
          </div>

          <div style="margin: 25px 0; padding: 20px; background: #f8f9fa; border-radius: 8px;">
            <h3 style="color: #333; margin-top: 0;">Your Login Credentials:</h3>
            <ul style="margin: 10px 0; padding-left: 20px; line-height: 1.8;">
              <li><strong>Email:</strong> ${data.email}</li>
              <li><strong>Password:</strong> Use the password you created during registration</li>
            </ul>
          </div>

          <div style="margin: 25px 0; padding: 20px; background: #e3f2fd; border-radius: 8px; border-left: 4px solid #2196f3;">
            <h3 style="color: #0d47a1; margin-top: 0;">What you can do now:</h3>
            <ul style="margin: 10px 0; padding-left: 20px; line-height: 1.8; color: #0d47a1;">
              <li>Browse and order tools and materials</li>
              <li>Track your order status and delivery</li>
              <li>Manage your account and preferences</li>
              <li>Access customer support</li>
              <li>View your order history</li>
            </ul>
          </div>
        </div>

        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px;">
          <p style="margin: 0;">Welcome to ToolLink! We're here to help you succeed.</p>
          <p style="margin: 5px 0 0 0;">© ${new Date().getFullYear()} ToolLink. All rights reserved.</p>
        </div>
      </div>
    `
  },
  'admin-new-customer-pending': {
    subject: '🔔 New Customer Registration Pending Approval',
    html: (data) => `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; color: #333;">
        <div style="background: linear-gradient(135deg, #6c757d 0%, #495057 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">🔔 New Customer Registration</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Approval Required</p>
        </div>

        <div style="padding: 30px; background: white;">
          <h2 style="color: #333; margin-bottom: 20px;">New Customer Awaiting Approval</h2>

          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            A new customer has registered for a ToolLink account and requires administrator approval before they can access the system.
          </p>

          <div style="margin: 25px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #6c757d;">
            <h3 style="color: #333; margin-top: 0;">👤 Customer Details:</h3>
            <ul style="margin: 10px 0; padding-left: 20px; line-height: 1.8;">
              <li><strong>Full Name:</strong> ${data.fullName}</li>
              <li><strong>Email:</strong> ${data.email}</li>
              <li><strong>Phone:</strong> ${data.phone || 'Not provided'}</li>
              <li><strong>Registration Date:</strong> ${new Date(data.submittedAt).toLocaleString()}</li>
              <li><strong>Status:</strong> Pending Approval</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.adminUrl || process.env.ADMIN_DASHBOARD_URL + '/customers/pending'}" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; display: inline-block; margin-right: 10px;">
              ✅ Approve Customer
            </a>
            <a href="${data.adminUrl || process.env.ADMIN_DASHBOARD_URL + '/customers/pending'}" style="background: linear-gradient(135deg, #6c757d 0%, #495057 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; display: inline-block;">
              📋 Review Details
            </a>
          </div>

          <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <p style="color: #856404; margin: 0;">
              💡 <strong>Quick Reminder:</strong> Please review and approve customer registrations promptly to maintain excellent customer service standards.
            </p>
          </div>
        </div>

        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px;">
          <p style="margin: 0;">ToolLink Customer Registration System</p>
          <p style="margin: 5px 0 0 0;">© ${new Date().getFullYear()} ToolLink. All rights reserved.</p>
        </div>
      </div>
    `
  },
  'customer-rejected': {
    subject: 'ToolLink Registration Update',
    html: (data) => `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; color: #333;">
        <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">Registration Update</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Regarding your ToolLink application</p>
        </div>

        <div style="padding: 30px; background: white;">
          <h2 style="color: #333; margin-bottom: 20px;">Hello ${data.fullName},</h2>

          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Thank you for your interest in ToolLink. After careful review of your registration, we are unable to approve your account at this time.
          </p>

          <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #721c24; margin-top: 0;">Reason for Decision:</h3>
            <p style="color: #721c24; margin: 10px 0;">
              ${data.reason || 'Your application did not meet our current approval criteria.'}
            </p>
          </div>

          <p style="font-size: 16px; line-height: 1.6; margin: 25px 0;">
            If you believe this decision was made in error or if you would like to discuss your application further, please don't hesitate to contact our support team.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="mailto:${process.env.SUPPORT_EMAIL || 'support@toollink.com'}" style="background: linear-gradient(135deg, #17a2b8 0%, #138496 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; display: inline-block;">
              📧 Contact Support
            </a>
          </div>
        </div>

        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px;">
          <p style="margin: 0;">Thank you for your understanding.</p>
          <p style="margin: 5px 0 0 0;">© ${new Date().getFullYear()} ToolLink. All rights reserved.</p>
        </div>
      </div>
    `
  },
  'customer-contact-message': {
    subject: '📩 New Customer Message Received - ToolLink',
    html: (data) => `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; color: #333;">
        <div style="background: linear-gradient(135deg, #17a2b8 0%, #138496 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">📩 New Customer Message</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">A customer has sent a message via the contact form</p>
        </div>

        <div style="padding: 30px; background: white;">
          <h2 style="color: #333; margin-bottom: 20px;">New Message Alert</h2>

          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            A new customer message has been received through the ToolLink contact form and requires your attention.
          </p>

          <div style="margin: 25px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #17a2b8;">
            <h3 style="color: #333; margin-top: 0;">📋 Message Details:</h3>
            <ul style="margin: 10px 0; padding-left: 20px; line-height: 1.8;">
              <li><strong>Customer Name:</strong> ${data.customerName}</li>
              <li><strong>Email:</strong> ${data.customerEmail}</li>
              <li><strong>Phone:</strong> ${data.customerPhone || 'Not provided'}</li>
              <li><strong>Subject:</strong> ${data.subject}</li>
              <li><strong>Received:</strong> ${new Date().toLocaleString()}</li>
            </ul>
          </div>

          <div style="margin: 25px 0; padding: 20px; background: #fff; border: 1px solid #dee2e6; border-radius: 8px;">
            <h4 style="color: #333; margin-top: 0; margin-bottom: 15px;">💬 Message Content:</h4>
            <p style="font-size: 16px; line-height: 1.6; margin: 0; padding: 15px; background: #f8f9fa; border-radius: 6px; font-style: italic;">
              "${data.message}"
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.adminUrl || process.env.ADMIN_DASHBOARD_URL || 'http://localhost:5173/admin/messages'}" style="background: linear-gradient(135deg, #17a2b8 0%, #138496 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; display: inline-block;">
              📧 Reply to Customer
            </a>
          </div>

          <div style="background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <p style="color: #0c5460; margin: 0;">
              💡 <strong>Quick Tip:</strong> Reply to this customer promptly to maintain excellent customer service standards.
            </p>
          </div>
        </div>

        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px;">
          <p style="margin: 0;">ToolLink Customer Message Notification System</p>
          <p style="margin: 5px 0 0 0;">© ${new Date().getFullYear()} ToolLink. All rights reserved.</p>
        </div>
      </div>
    `
  },
  'customer-message-reply': {
    subject: '✉️ Reply from ToolLink Support',
    html: (data) => `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; color: #333;">
        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">✉️ ToolLink Support</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">We have responded to your message</p>
        </div>

        <div style="padding: 30px; background: white;">
          <h2 style="color: #333; margin-bottom: 20px;">Hello ${data.customerName}!</h2>

          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Thank you for contacting ToolLink support. We have reviewed your message and here is our response:
          </p>

          <div style="margin: 25px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #28a745;">
            <h4 style="color: #333; margin-top: 0; margin-bottom: 15px;">📧 Your Original Message:</h4>
            <p style="font-size: 14px; line-height: 1.5; margin: 0; color: #666; font-style: italic;">
              "${data.originalMessage}"
            </p>
          </div>

          <div style="margin: 25px 0; padding: 20px; background: #fff; border: 1px solid #28a745; border-radius: 8px;">
            <h4 style="color: #28a745; margin-top: 0; margin-bottom: 15px;">💬 Our Response:</h4>
            <p style="font-size: 16px; line-height: 1.6; margin: 0;">
              ${data.replyMessage}
            </p>
            <p style="font-size: 14px; color: #666; margin: 15px 0 0 0;">
              <strong>Replied by:</strong> ${data.supportAgent || 'ToolLink Support Team'}
            </p>
          </div>

          <p style="font-size: 16px; line-height: 1.6; margin: 25px 0;">
            If you have any additional questions or need further assistance, please don't hesitate to contact us again.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.contactUrl || process.env.FRONTEND_URL || 'http://localhost:5173/contact'}" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; display: inline-block;">
              📞 Contact Us Again
            </a>
          </div>
        </div>

        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px;">
          <p style="margin: 0;">Thank you for choosing ToolLink!</p>
          <p style="margin: 5px 0 0 0;">© ${new Date().getFullYear()} ToolLink. All rights reserved.</p>
        </div>
      </div>
    `
  },

  'customer-thank-you': {
    subject: 'Thank you for contacting ToolLink - We received your message!',
    html: (data) => `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; color: #333;">
        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">✅ Message Received!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Thank you for contacting ToolLink</p>
        </div>

        <div style="padding: 30px; background: white;">
          <h2 style="color: #333; margin-bottom: 20px;">Hello ${data.customerName}!</h2>

          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Thank you for reaching out to us! We have successfully received your message and want to let you know that we take every inquiry seriously.
          </p>

          <div style="background: #f8f9fa; border-left: 4px solid #28a745; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <h3 style="color: #333; margin-top: 0; display: flex; align-items: center;">
              📧 Your Message Details
            </h3>
            <p style="margin: 5px 0;"><strong>Subject:</strong> ${data.subject}</p>
            <p style="margin: 5px 0;"><strong>Submission ID:</strong> #${data.submissionId.toString().slice(-8).toUpperCase()}</p>
            <p style="margin: 5px 0;"><strong>Received:</strong> ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
          </div>

          <div style="background: #e7f3ff; border: 1px solid #b3d9ff; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #0066cc; margin-top: 0;">⏰ What happens next?</h3>
            <ul style="margin: 10px 0; padding-left: 20px; color: #0066cc;">
              <li>Our team will review your message within 24 hours</li>
              <li>You'll receive a personalized response from our experts</li>
              <li>We'll address your specific questions and requirements</li>
              <li>If needed, we may contact you for additional information</li>
            </ul>
          </div>

          <p style="font-size: 16px; line-height: 1.6; margin: 25px 0;">
            In the meantime, feel free to explore our website and learn more about our services. If you have any urgent questions, don't hesitate to contact us directly.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.websiteUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; display: inline-block; margin-right: 10px;">
              🌐 Visit Our Website
            </a>
            <a href="mailto:${data.supportEmail}" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; display: inline-block;">
              📧 Contact Support
            </a>
          </div>

          <div style="margin-top: 30px; padding: 20px; background: #fff3cd; border-radius: 8px; border: 1px solid #ffeaa7;">
            <h4 style="color: #856404; margin-top: 0;">📱 Stay Connected</h4>
            <p style="color: #856404; margin: 0;">
              Follow us on social media for the latest updates, tips, and industry insights from the ToolLink team.
            </p>
          </div>
        </div>

        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px;">
          <p style="margin: 0;">This is an automated confirmation email. Please do not reply to this email.</p>
          <p style="margin: 5px 0;">For questions, contact us at <a href="mailto:${data.supportEmail}" style="color: #667eea;">${data.supportEmail}</a></p>
          <p style="margin: 5px 0 0 0;">© ${new Date().getFullYear()} ${data.companyName}. All rights reserved.</p>
        </div>
      </div>
    `
  },
  'driver-welcome': {
    subject: '🚚 Welcome to ToolLink - Your Driver Account is Ready!',
    html: (data) => `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; color: #333;">
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">🚚 Welcome to ToolLink!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Your driver account is ready for action</p>
        </div>

        <div style="padding: 30px; background: white;">
          <h2 style="color: #333; margin-bottom: 20px;">Hello ${data.fullName}!</h2>

          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Welcome to the ToolLink delivery team! Your driver account has been successfully created and you're ready to start making deliveries.
          </p>

          <div style="background: #ddd6fe; border: 1px solid #c4b5fd; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #5b21b6; margin-top: 0;">🎯 Your Account Details</h3>
            <ul style="margin: 10px 0; padding-left: 20px; line-height: 1.8; color: #5b21b6;">
              <li><strong>Email:</strong> ${data.email}</li>
              <li><strong>Name:</strong> ${data.fullName}</li>
              <li><strong>Phone:</strong> ${data.phone || 'Not provided'}</li>
              <li><strong>License Number:</strong> ${data.licenseNumber || 'Not provided'}</li>
              <li><strong>Vehicle:</strong> ${data.vehicleType || 'Not specified'} - ${data.plateNumber || 'No plate'}</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.driverPortalUrl || process.env.FRONTEND_URL + '/driver-portal'}" style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; display: inline-block;">
              🚀 Access Driver Portal
            </a>
          </div>

          <div style="margin: 25px 0; padding: 20px; background: #ecfdf5; border-radius: 8px; border-left: 4px solid #10b981;">
            <h3 style="color: #047857; margin-top: 0;">🛣️ What you can do:</h3>
            <ul style="margin: 10px 0; padding-left: 20px; line-height: 1.8; color: #047857;">
              <li>View assigned deliveries in real-time</li>
              <li>Update delivery status as you progress</li>
              <li>Navigate to customer locations with ease</li>
              <li>Communicate with dispatch team</li>
              <li>Track your delivery history and performance</li>
            </ul>
          </div>

          <div style="margin: 25px 0; padding: 20px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <h3 style="color: #92400e; margin-top: 0;">📱 How to get started:</h3>
            <ol style="margin: 10px 0; padding-left: 20px; line-height: 1.8; color: #92400e;">
              <li>Login to the Driver Portal using your email and password</li>
              <li>Complete your profile information if needed</li>
              <li>Check for assigned deliveries</li>
              <li>Start making deliveries and updating status</li>
            </ol>
          </div>

          <p style="font-size: 16px; line-height: 1.6; margin: 25px 0;">
            If you have any questions or need assistance, please don't hesitate to contact our dispatch team.
          </p>
        </div>

        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px;">
          <p style="margin: 0;">Welcome to the ToolLink delivery team! Drive safely and deliver excellence.</p>
          <p style="margin: 5px 0 0 0;">© ${new Date().getFullYear()} ToolLink. All rights reserved.</p>
        </div>
      </div>
    `
  },
  'test-email': {
    subject: '✅ ToolLink Email System Test - Configuration Successful',
    html: (data) => `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; color: #333;">
        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">🎉 Email System Test</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Configuration successful!</p>
        </div>

        <div style="padding: 30px; background: white;">
          <h2 style="color: #333; margin-bottom: 20px;">Email Configuration Test Result</h2>

          <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #155724; margin-top: 0;">✅ Success!</h3>
            <p style="color: #155724; margin: 10px 0;">
              ${data.testMessage}
            </p>
            <p style="color: #155724; margin: 5px 0;"><strong>Timestamp:</strong> ${data.timestamp}</p>
          </div>

          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Your ToolLink email system is now configured and working perfectly with:
          </p>

          <ul style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            <li>📧 Email: toollinksrilanka@gmail.com</li>
            <li>🔐 Gmail App Password authentication</li>
            <li>📤 SMTP sending capability</li>
            <li>🎯 Customer message reply functionality</li>
          </ul>

          <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h4 style="color: #856404; margin-top: 0;">📋 Next Steps:</h4>
            <ul style="color: #856404; margin: 10px 0; padding-left: 20px;">
              <li>Test customer message replies in the admin dashboard</li>
              <li>Verify that customers receive your responses</li>
              <li>Monitor email delivery and system performance</li>
            </ul>
          </div>

        </div>

        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px;">
          <p style="margin: 0;">This is a test email from ToolLink Sri Lanka email system.</p>
          <p style="margin: 5px 0 0 0;">© ${new Date().getFullYear()} ToolLink Sri Lanka. All rights reserved.</p>
        </div>
      </div>
    `
  },

  'order-confirmed': {
    subject: 'Your ToolLink Order has been Confirmed!',
    html: (data) => `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; color: #333;">
        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">Order Confirmed! 🎉</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Your order is ready for processing</p>
        </div>

        <div style="padding: 30px; background: white;">
          <h2 style="color: #333; margin-bottom: 20px;">Hello ${data.customerName}!</h2>

          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Great news! Your order <strong>#${data.orderNumber}</strong> has been approved and confirmed by our team.
          </p>

          <div style="background: #f8f9fa; border-left: 4px solid #28a745; padding: 20px; margin: 25px 0;">
            <h3 style="margin-top: 0; color: #28a745;">Order Details</h3>
            <p style="margin: 5px 0;"><strong>Order Number:</strong> #${data.orderNumber}</p>
            <p style="margin: 5px 0;"><strong>Order Date:</strong> ${data.orderDate}</p>
            <p style="margin: 5px 0;"><strong>Approved by:</strong> ${data.approvedBy}</p>
            <p style="margin: 5px 0;"><strong>Items Count:</strong> ${data.items.length} items</p>
          </div>

          <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h4 style="color: #856404; margin-top: 0;">📦 Items Ordered:</h4>
            <ul style="color: #856404; margin: 10px 0; padding-left: 20px;">
              ${data.items.map(item => `<li>${item.name} - Quantity: ${item.quantity}</li>`).join('')}
            </ul>
          </div>

          <div style="background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h4 style="color: #0c5460; margin-top: 0;">📋 What's Next?</h4>
            <ul style="color: #0c5460; margin: 10px 0; padding-left: 20px;">
              <li>Your order is now in our fulfillment queue</li>
              <li>You'll receive delivery updates via notifications</li>
              <li>Contact us if you have any questions about your order</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <p style="font-size: 16px; margin-bottom: 20px;">
              Thank you for choosing ToolLink for your tool needs!
            </p>
          </div>

        </div>

        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px;">
          <p style="margin: 0;">Questions? Contact us at toollinksrilanka@gmail.com</p>
          <p style="margin: 5px 0 0 0;">© ${new Date().getFullYear()} ToolLink Sri Lanka. All rights reserved.</p>
        </div>
      </div>
    `
  }
};

// Send email function with improved error handling
export const sendEmail = async ({ to, subject, template, data, html, text }) => {
  try {
    let emailSubject = subject;
    let emailHtml = html;
    let emailText = text;

    // Use template if provided
    if (template && emailTemplates[template]) {
      emailSubject = emailTemplates[template].subject;
      emailHtml = emailTemplates[template].html(data);
    }

    const mailOptions = {
      from: `${process.env.FROM_NAME || 'ToolLink Sri Lanka'} <${process.env.TOOLLINK_EMAIL || 'toollinksrilanka@gmail.com'}>`,
      to,
      subject: emailSubject,
      html: emailHtml,
      text: emailText
    };

    // Verify transporter configuration before sending
    await transporter.verify();

    const result = await transporter.sendMail(mailOptions);

    logger.info('Email sent successfully', {
      to,
      subject: emailSubject,
      messageId: result.messageId
    });

    return result;
  } catch (error) {
    logger.error('Email sending failed', {
      error: error.message,
      to,
      subject,
      stack: error.stack
    });
    throw error;
  }
};

// Send bulk emails
export const sendBulkEmails = async (emails) => {
  const results = [];

  for (const email of emails) {
    try {
      const result = await sendEmail(email);
      results.push({ success: true, email: email.to, result });
    } catch (error) {
      results.push({ success: false, email: email.to, error: error.message });
    }
  }

  return results;
};

// Test email connectivity
export const testEmailConnection = async () => {
  try {
    await transporter.verify();
    logger.info('Email service connection verified successfully');
    return { success: true, message: 'Email service is working correctly' };
  } catch (error) {
    logger.error('Email service connection failed', { error: error.message });
    return { success: false, message: error.message };
  }
};
