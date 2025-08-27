# Email Notification System

The Email Notification System is a comprehensive email delivery platform that handles all email communications for BoosterBeacon, including alerts, welcome messages, password resets, and marketing communications.

## Overview

The system provides multi-provider email delivery with advanced features like template management, delivery tracking, bounce handling, and user preference management. It supports multiple SMTP configurations and provides detailed analytics for email performance.

## Architecture

### Core Components

#### EmailService
The main email service that handles:
- Email template generation and rendering
- SMTP transport management
- Delivery tracking and analytics
- Bounce and complaint handling
- Multi-provider configuration support

#### EmailTemplateService
Dedicated template management service that provides:
- HTML and text template generation
- Responsive email designs
- Dynamic content rendering
- Template caching and optimization
- Multi-language support (future)

#### EmailPreferencesService
User preference management service that handles:
- Email subscription preferences
- Unsubscribe token generation and validation
- Quiet hours and delivery scheduling
- Preference persistence and retrieval

#### EmailDeliveryService
Delivery tracking and analytics service that provides:
- Delivery status monitoring
- Bounce and complaint tracking
- Performance metrics and reporting
- Delivery history and logs

#### EmailTransportService
SMTP transport configuration service that manages:
- Multiple SMTP provider configurations
- Connection pooling and management
- Transport health monitoring
- Failover and redundancy

## Email Types

### Alert Emails
Real-time notifications when watched products become available or experience price changes.

**Features:**
- Rich HTML templates with product images
- Direct cart links for instant purchasing
- Priority-based styling and formatting
- Mobile-responsive design
- Unsubscribe links and preference management

**Template Variables:**
```typescript
interface AlertTemplateData {
  user: IUser;
  alert: IAlert;
  productName: string;
  retailerName: string;
  price?: string;
  originalPrice?: string;
  productUrl: string;
  cartUrl?: string;
  frontendUrl: string;
  unsubscribeToken: string;
}
```

### Welcome Emails
Onboarding emails sent to new users upon registration.

**Features:**
- Branded welcome message with Pokémon theme
- Feature highlights and getting started guide
- Call-to-action buttons for key features
- Newsletter subscription confirmation
- Social media links and community information

### Password Reset Emails
Security emails for password reset requests.

**Features:**
- Secure token-based reset links
- Expiration time warnings
- Security best practices information
- Clear instructions and troubleshooting
- No unsubscribe (system email)

### Marketing Emails
Promotional and informational emails for user engagement.

**Features:**
- Product announcements and updates
- Collecting tips and best practices
- Community highlights and testimonials
- Subscription upgrade promotions
- Event notifications and special offers

### Digest Emails
Weekly or monthly summaries of user activity and alerts.

**Features:**
- Personalized alert summaries
- Popular product recommendations
- Performance statistics and insights
- Community updates and news
- Preference management links

## SMTP Configuration

### Amazon SES (Production)
Primary email provider for production environments.

```bash
# Environment variables
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
SES_CONFIGURATION_SET=boosterbeacon-emails
FROM_EMAIL=alerts@boosterbeacon.com
FROM_NAME=BoosterBeacon
```

**Features:**
- High deliverability rates
- Bounce and complaint handling
- Detailed delivery analytics
- Scalable sending limits
- Reputation management

### Local SMTP (Self-hosted)
For self-hosted deployments using local mail servers.

```bash
# Environment variables
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_SECURE=false
SMTP_TLS_REJECT_UNAUTHORIZED=false
FROM_EMAIL=alerts@yourdomain.com
FROM_NAME=BoosterBeacon
```

**Features:**
- Full control over email delivery
- No external dependencies
- Cost-effective for high volumes
- Custom configuration options
- Integration with existing mail infrastructure

### Ethereal Email (Development)
Testing email service for development environments.

```bash
# Environment variables (automatically configured)
NODE_ENV=development
# No additional configuration required
```

**Features:**
- Fake SMTP service for testing
- Web-based email preview
- No actual email delivery
- Perfect for development and testing
- Automatic configuration

### Custom SMTP (Third-party)
Support for any SMTP provider (Gmail, Outlook, SendGrid, etc.).

```bash
# Environment variables
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
FROM_EMAIL=your_email@gmail.com
FROM_NAME=BoosterBeacon
```

## Email Templates

### Template Structure
All email templates follow a consistent structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Title</title>
    <!-- Inline CSS styles -->
</head>
<body>
    <div class="container">
        <!-- Header with logo and branding -->
        <div class="header">
            <div class="logo">🔥 BoosterBeacon</div>
            <div class="tagline">Email Title</div>
        </div>
        
        <!-- Main content area -->
        <div class="content">
            <!-- Dynamic content -->
        </div>
        
        <!-- Footer with links and unsubscribe -->
        <div class="footer">
            <!-- Footer content -->
        </div>
    </div>
</body>
</html>
```

### Responsive Design
All templates are mobile-responsive with:
- Fluid layouts that adapt to screen size
- Touch-friendly buttons and links
- Optimized font sizes for mobile reading
- Compressed images for faster loading
- Fallback fonts for better compatibility

### Brand Consistency
Templates maintain brand consistency with:
- Pokémon-themed color scheme
- Consistent typography and spacing
- BoosterBeacon logo and branding
- Professional yet playful design language
- Collector-focused messaging and tone

## User Preferences

### Email Types
Users can control their email preferences for different types:

```typescript
interface EmailPreferences {
  alertEmails: boolean;      // Product alerts and notifications
  marketingEmails: boolean;  // Promotional and informational emails
  weeklyDigest: boolean;     // Weekly summary emails
}
```

### Preference Management
- **Granular Control**: Users can enable/disable specific email types
- **One-Click Unsubscribe**: Direct unsubscribe links in all emails
- **Preference Center**: Web interface for managing all email settings
- **Instant Updates**: Preference changes take effect immediately
- **Audit Trail**: Track preference changes for compliance

### Unsubscribe System
Secure token-based unsubscribe system:

```typescript
// Generate unsubscribe token
const token = await EmailPreferencesService.createUnsubscribeToken(
  userId, 
  'alerts'
);

// Process unsubscribe request
const result = await EmailPreferencesService.processUnsubscribe(token);
```

**Features:**
- Secure token generation with expiration
- Type-specific unsubscribe (alerts, marketing, etc.)
- Immediate preference updates
- Confirmation messages
- Re-subscription options

## Delivery Tracking

### Delivery Status
Track email delivery status throughout the lifecycle:

```typescript
interface EmailDeliveryStatus {
  sent: boolean;        // Email sent to SMTP server
  delivered: boolean;   // Email delivered to recipient
  bounced: boolean;     // Email bounced (hard/soft)
  complained: boolean;  // Recipient marked as spam
  opened: boolean;      // Email opened by recipient (future)
  clicked: boolean;     // Links clicked in email (future)
}
```

### Analytics and Metrics
Comprehensive email performance analytics:

```typescript
interface EmailStats {
  totalSent: number;           // Total emails sent
  totalDelivered: number;      // Successfully delivered
  totalBounced: number;        // Bounced emails
  totalComplained: number;     // Spam complaints
  deliveryRate: number;        // Delivery success rate
  bounceRate: number;          // Bounce rate percentage
  complaintRate: number;       // Complaint rate percentage
  lastEmailSent: Date;         // Last email timestamp
}
```

### Bounce Handling
Automatic bounce processing and management:

- **Hard Bounces**: Permanent delivery failures (invalid email, domain doesn't exist)
- **Soft Bounces**: Temporary delivery failures (mailbox full, server down)
- **Automatic Suppression**: Automatically suppress hard bounced addresses
- **Retry Logic**: Retry soft bounces with exponential backoff
- **Notification**: Alert administrators of high bounce rates

### Complaint Handling
Spam complaint processing and reputation management:

- **Automatic Processing**: Process spam complaints from ISPs
- **Suppression Lists**: Automatically suppress complainers
- **Reputation Monitoring**: Track sender reputation metrics
- **Feedback Loops**: Integration with ISP feedback loops
- **Compliance**: Ensure CAN-SPAM and GDPR compliance

## API Endpoints

### Email Preferences
```http
GET /api/v1/email/preferences      # Get user preferences
PUT /api/v1/email/preferences      # Update preferences
GET /api/v1/email/unsubscribe      # Process unsubscribe
```

### Email Statistics
```http
GET /api/v1/email/stats           # Get user email stats
GET /api/v1/email/analytics       # Get detailed analytics
```

### Email Testing
```http
POST /api/v1/email/send-test      # Send test email
POST /api/v1/email/test           # Test configuration
```

### Email Configuration
```http
GET /api/v1/email/config          # Get configuration status
POST /api/v1/email/config/test    # Test email delivery
GET /api/v1/email/config/env-template  # Get env template
```

### Email Management
```http
POST /api/v1/email/send-digest    # Send digest email
POST /api/v1/email/webhook        # Handle email webhooks
```

## Security and Compliance

### Data Protection
- **Minimal Data Collection**: Only collect necessary email data
- **Encryption**: Encrypt sensitive data at rest and in transit
- **Access Control**: Restrict access to email data and logs
- **Retention Policies**: Automatic cleanup of old email logs
- **Anonymization**: Remove PII from analytics and logs

### Compliance Standards
- **CAN-SPAM Act**: Comply with US anti-spam regulations
- **GDPR**: European data protection compliance
- **CASL**: Canadian anti-spam legislation compliance
- **Unsubscribe Requirements**: Honor unsubscribe requests immediately
- **Sender Identification**: Clear sender identification in all emails

### Authentication and Security
- **SPF Records**: Sender Policy Framework for domain authentication
- **DKIM Signing**: DomainKeys Identified Mail for message integrity
- **DMARC Policy**: Domain-based Message Authentication for reputation
- **TLS Encryption**: Encrypted SMTP connections
- **API Security**: Secure API endpoints with authentication

## Performance Optimization

### Template Caching
- **Compiled Templates**: Cache compiled template functions
- **Static Assets**: CDN delivery for images and stylesheets
- **Minification**: Minify HTML and CSS for smaller payloads
- **Compression**: Gzip compression for email content
- **Lazy Loading**: Load template assets on demand

### Connection Management
- **Connection Pooling**: Reuse SMTP connections for efficiency
- **Keep-Alive**: Maintain persistent connections
- **Load Balancing**: Distribute load across multiple SMTP servers
- **Circuit Breakers**: Prevent cascade failures
- **Timeout Management**: Proper timeout handling for reliability

### Delivery Optimization
- **Batch Processing**: Send multiple emails in batches
- **Rate Limiting**: Respect provider sending limits
- **Priority Queues**: Prioritize urgent emails
- **Retry Logic**: Intelligent retry with exponential backoff
- **Failover**: Automatic failover to backup providers

## Monitoring and Alerting

### Health Monitoring
- **SMTP Health**: Monitor SMTP server connectivity and response times
- **Delivery Rates**: Track delivery success rates and trends
- **Error Rates**: Monitor bounce and complaint rates
- **Queue Depth**: Track email queue backlog
- **Performance Metrics**: Response times and throughput

### Alerting Rules
- **High Bounce Rate**: Alert when bounce rate exceeds 5%
- **High Complaint Rate**: Alert when complaint rate exceeds 0.1%
- **Delivery Failures**: Alert on SMTP connection failures
- **Queue Backup**: Alert when email queue exceeds threshold
- **Configuration Issues**: Alert on misconfiguration or credential issues

### Logging and Debugging
- **Structured Logging**: JSON-formatted logs with correlation IDs
- **Email Tracking**: Track individual email lifecycle
- **Error Details**: Detailed error messages and stack traces
- **Performance Logs**: Response times and delivery metrics
- **Audit Trails**: Track all email-related actions and changes

## Development and Testing

### Local Development
```bash
# Start development environment
npm run dev

# Email service will automatically use Ethereal Email
# Check console for preview URLs
```

### Testing Email Templates
```bash
# Send test emails
curl -X POST http://localhost:3000/api/v1/email/send-test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "type": "welcome"}'
```

### Email Preview
- **Ethereal Email**: Automatic preview URLs in development
- **Template Testing**: Send test emails to verify rendering
- **Cross-Client Testing**: Test across different email clients
- **Mobile Testing**: Verify mobile responsiveness
- **Accessibility Testing**: Ensure emails are accessible

## Best Practices

### Template Design
- **Mobile-First**: Design for mobile devices first
- **Progressive Enhancement**: Enhance for desktop capabilities
- **Fallback Fonts**: Use web-safe font stacks
- **Alt Text**: Include alt text for all images
- **Clear CTAs**: Make call-to-action buttons prominent

### Content Guidelines
- **Clear Subject Lines**: Descriptive and engaging subject lines
- **Scannable Content**: Use headings, bullets, and short paragraphs
- **Value Proposition**: Lead with the most important information
- **Personal Touch**: Use personalization when appropriate
- **Brand Voice**: Maintain consistent brand voice and tone

### Deliverability Best Practices
- **List Hygiene**: Regularly clean email lists
- **Engagement Tracking**: Monitor open and click rates
- **Reputation Management**: Maintain good sender reputation
- **Authentication**: Implement SPF, DKIM, and DMARC
- **Content Quality**: Avoid spam trigger words and phrases

## Troubleshooting

### Common Issues

#### High Bounce Rate
1. **Check Email Validation**: Ensure proper email validation on signup
2. **List Hygiene**: Remove invalid emails from lists
3. **Domain Reputation**: Check sender domain reputation
4. **Content Issues**: Review email content for spam triggers

#### Low Delivery Rate
1. **SMTP Configuration**: Verify SMTP settings and credentials
2. **Authentication**: Check SPF, DKIM, and DMARC records
3. **IP Reputation**: Monitor sender IP reputation
4. **Provider Limits**: Check sending rate limits

#### Template Rendering Issues
1. **HTML Validation**: Validate HTML markup
2. **CSS Compatibility**: Use email-safe CSS properties
3. **Image Loading**: Ensure images are accessible
4. **Client Testing**: Test across different email clients

### Debugging Commands
```bash
# Test email configuration
curl -X POST http://localhost:3000/api/v1/email/config/test \
  -H "Authorization: Bearer $TOKEN"

# Check email statistics
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/email/stats

# View email configuration
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/email/config
```

## Future Enhancements

### Planned Features
- **Email Analytics**: Open and click tracking
- **A/B Testing**: Template and subject line testing
- **Personalization**: Advanced personalization engine
- **Automation**: Drip campaigns and automated sequences
- **Segmentation**: Advanced user segmentation

### Advanced Features
- **Multi-language**: Internationalization support
- **Dynamic Content**: Real-time content generation
- **Interactive Emails**: AMP for Email support
- **AI Optimization**: AI-powered send time optimization
- **Advanced Analytics**: Predictive analytics and insights

This email system provides a robust, scalable foundation for all email communications while maintaining high deliverability, user experience, and compliance standards.