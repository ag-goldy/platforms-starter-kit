import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    console.log('[Test Email] Sending to:', email);
    console.log('[Test Email] Graph Configured:', !!process.env.MICROSOFT_GRAPH_TENANT_ID);
    console.log('[Test Email] SMTP Configured:', !!process.env.SMTP_HOST);

    const startTime = Date.now();
    
    await sendEmail({
      to: email,
      subject: 'Atlas Support - Test Email',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #F97316;">Test Email from Atlas Support</h2>
          <p>This is a test email sent at: <strong>${new Date().toLocaleString()}</strong></p>
          <p>If you received this, your email configuration is working!</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #666; font-size: 12px;">Sent from Atlas Support Platform</p>
        </div>
      `,
      text: `Test Email from Atlas Support\n\nThis is a test email sent at: ${new Date().toLocaleString()}\n\nIf you received this, your email configuration is working!`,
    });

    const duration = Date.now() - startTime;
    
    console.log('[Test Email] ✅ Sent successfully in', duration, 'ms');
    
    return NextResponse.json({ 
      success: true, 
      message: `Test email sent to ${email} in ${duration}ms`,
      config: {
        graph: !!process.env.MICROSOFT_GRAPH_TENANT_ID,
        smtp: !!process.env.SMTP_HOST,
        from: process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_FROM || 'not set',
      }
    });
  } catch (error: any) {
    console.error('[Test Email] ❌ Failed:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      details: error.body || null,
      code: error.code || null,
      statusCode: error.statusCode || null,
      config: {
        graph: !!process.env.MICROSOFT_GRAPH_TENANT_ID,
        smtp: !!process.env.SMTP_HOST,
        from: process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_FROM || 'not set',
      }
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Email test endpoint',
    usage: 'POST to this endpoint with { "email": "your@email.com" }',
    config: {
      graphConfigured: !!process.env.MICROSOFT_GRAPH_TENANT_ID,
      smtpConfigured: !!process.env.SMTP_HOST,
      fromAddress: process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_FROM || 'not set',
    }
  });
}
