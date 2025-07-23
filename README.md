# Spaceport CRM

A modern, cloud-native CRM system built with Next.js, AWS CDK, DynamoDB, and Cognito authentication.

## 🚀 Features

- **Real-time Data Persistence**: All data is stored in AWS DynamoDB with automatic synchronization
- **Multi-user Support**: Shared database accessible by all company employees
- **CSV Import**: Bulk import of leads with intelligent parsing
- **Activity Tracking**: Track calls, emails, notes, and interactions
- **Priority Management**: Automated priority calculation based on sales cadence
- **Responsive Design**: Modern UI that works on all devices
- **Authentication**: Secure user authentication with AWS Cognito

## 🏗️ Architecture

- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Backend**: AWS Lambda functions with API Gateway
- **Database**: Amazon DynamoDB with point-in-time recovery
- **Authentication**: AWS Cognito User Pool
- **Infrastructure**: AWS CDK for infrastructure as code

## 📋 Prerequisites

- Node.js 18+ and npm/pnpm
- AWS CLI configured with appropriate permissions
- AWS CDK CLI installed globally: `npm install -g aws-cdk`

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd spaceport-crm
pnpm install
```

### 2. Deploy Infrastructure

```bash
# Run the deployment script
./deploy.sh
```

This script will:
- Deploy the CDK infrastructure to AWS
- Create DynamoDB tables, Lambda functions, API Gateway, and Cognito User Pool
- Generate environment variables in `.env.local`

### 3. Start Development Server

```bash
pnpm run dev
```

Visit `http://localhost:3001` to access the application.

## 🔧 Configuration

### Environment Variables

The deployment script creates a `.env.local` file with the following variables:

```env
NEXT_PUBLIC_AWS_REGION=us-west-2
NEXT_PUBLIC_USER_POOL_ID=us-west-2_xxxxxxxxx
NEXT_PUBLIC_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_API_URL=https://xxxxxxxxxx.execute-api.us-west-2.amazonaws.com/prod
NEXT_PUBLIC_DEV_MODE=false
```

### Production Deployment

1. **Set Environment Variables**: Add the environment variables to your hosting platform (Vercel, Netlify, etc.)

2. **Build and Deploy**:
   ```bash
   pnpm run build
   # Deploy the 'out' directory to your hosting platform
   ```

3. **Verify Deployment**: Check that the application loads and can authenticate users.

## 📊 Database Schema

### Leads Table
- `id` (String, Primary Key): Unique lead identifier
- `name` (String): Contact name
- `email` (String): Email address
- `phone` (String): Phone number
- `address` (String): Property address
- `company` (String): Company name
- `status` (String): Lead status (cold, contacted, interested, closed, dormant, left voicemail)
- `priority` (String): Priority level (high, medium, low, dormant)
- `notes` (Array): Array of interaction notes
- `createdAt` (String): Creation timestamp
- `updatedAt` (String): Last update timestamp
- `createdBy` (String): User who created the lead
- `lastUpdatedBy` (String): User who last updated the lead

### Activities Table
- `id` (String, Primary Key): Unique activity identifier
- `timestamp` (Number, Sort Key): Activity timestamp
- `leadId` (String): Associated lead ID
- `type` (String): Activity type (note, call, email, meeting, task)
- `description` (String): Activity description
- `createdBy` (String): User who created the activity

## 🔐 Authentication

The application supports two authentication modes:

### Development Mode
- Uses localStorage for user management
- Demo accounts available for testing
- No external dependencies

### Production Mode
- Uses AWS Cognito for authentication
- Secure JWT tokens with automatic refresh
- Email verification required for new accounts

## 📈 Data Persistence

### Real-time Synchronization
- All lead updates are immediately saved to DynamoDB
- Activities are tracked separately for better performance
- Automatic conflict resolution and error handling

### Backup and Recovery
- DynamoDB point-in-time recovery enabled
- Data retention policy configured
- Cross-region backup available

## 🛠️ Development

### Local Development
```bash
# Start development server
pnpm run dev

# Run in development mode (localStorage)
# The app will automatically detect missing AWS config and use development mode
```

### Testing
```bash
# Run linting
pnpm run lint

# Build for production
pnpm run build
```

## 🔍 Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Check that environment variables are set correctly
   - Verify Cognito User Pool is configured properly
   - Ensure API Gateway CORS settings are correct

2. **Data Not Loading**
   - Check DynamoDB table permissions
   - Verify Lambda function execution role
   - Check API Gateway logs for errors

3. **CSV Import Issues**
   - Ensure CSV format matches expected schema
   - Check file size limits
   - Verify DynamoDB write capacity

### Debug Mode
Enable debug logging by setting `NEXT_PUBLIC_DEV_MODE=true` in your environment variables.

## 📝 API Endpoints

### Leads
- `GET /leads` - Get all leads
- `GET /leads/{id}` - Get specific lead
- `POST /leads` - Create new lead
- `PUT /leads/{id}` - Update lead
- `DELETE /leads/{id}` - Delete lead

### Activities
- `GET /activities` - Get all activities
- `GET /activities?leadId={id}` - Get activities for specific lead
- `POST /activities` - Create new activity

All endpoints require authentication via Cognito JWT tokens.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is proprietary software for internal company use.

## 🆘 Support

For support or questions, contact your system administrator or create an issue in the repository.
