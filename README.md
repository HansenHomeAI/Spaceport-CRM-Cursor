# Spaceport CRM

A luxury, high-end CRM application built with Next.js, featuring intelligent follow-up tracking, beautiful data visualization, and a sophisticated Apple-inspired design system.

## Features

- **Intelligent Follow-up System**: Automated cadence tracking with priority indicators
- **Enhanced Data Visualization**: Beautiful mini-charts showing weekly performance trends
- **Luxury Design System**: Apple-inspired glassmorphism with Helvetica Neue typography
- **Semantic Color System**: Distinct, meaningful colors for different statuses and interactions
- **Real-time Editing**: Inline editing with smooth animations and micro-interactions
- **CSV Import/Export**: Easy data management and migration
- **Responsive Design**: Optimized for all devices with consistent 25px border radius

## Tech Stack

### Frontend
- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **TanStack React Table** for data management
- **Lucide React** for icons

### Backend (AWS CDK)
- **AWS Lambda** for serverless functions
- **DynamoDB** for data storage
- **API Gateway** for REST API
- **AWS Cognito** for authentication
- **CloudFormation** for infrastructure as code

## Color System

### Status Colors
- **Cold**: Slate (neutral, inactive)
- **Contacted**: Blue (communication initiated)
- **Interested**: Emerald (positive engagement)
- **Closed**: Amber (successful completion)

### Interaction Colors
- **Call**: Green (direct communication)
- **Email**: Orange (digital communication)
- **Note**: Gray (internal documentation)

### Priority Colors
- **High**: Red (urgent attention needed)
- **Medium**: Yellow (moderate priority)
- **Low**: Green (routine follow-up)

## Getting Started

### Prerequisites
- Node.js 18+
- AWS CLI configured
- AWS CDK CLI installed

### Frontend Development

1. **Install dependencies**
   \`\`\`bash
   npm install
   \`\`\`

2. **Start development server**
   \`\`\`bash
   npm run dev
   \`\`\`

3. **Build for production**
   \`\`\`bash
   npm run build
   \`\`\`

### Backend Deployment

1. **Navigate to CDK directory**
   \`\`\`bash
   cd cdk
   \`\`\`

2. **Install CDK dependencies**
   \`\`\`bash
   npm install
   \`\`\`

3. **Bootstrap CDK (first time only)**
   \`\`\`bash
   cdk bootstrap
   \`\`\`

4. **Deploy infrastructure**
   \`\`\`bash
   cdk deploy
   \`\`\`

### GitHub Pages Deployment

The application is configured for automatic deployment to GitHub Pages:

1. **Push to main branch** - triggers GitHub Actions
2. **Automatic build** - Next.js static export
3. **Deploy to GitHub Pages** - serves static files

## Project Structure

\`\`\`
spaceport-crm/
├── app/                    # Next.js app directory
├── components/             # React components
├── lib/                   # Utility functions and configs
├── cdk/                   # AWS CDK infrastructure
├── .github/workflows/     # GitHub Actions
└── public/               # Static assets
\`\`\`

## Environment Variables

### Frontend (.env.local)
\`\`\`
NEXT_PUBLIC_API_URL=your-api-gateway-url
NEXT_PUBLIC_USER_POOL_ID=your-cognito-user-pool-id
NEXT_PUBLIC_USER_POOL_CLIENT_ID=your-cognito-client-id
\`\`\`

### CDK Deployment
\`\`\`
CDK_DEFAULT_ACCOUNT=your-aws-account-id
CDK_DEFAULT_REGION=your-preferred-region
\`\`\`

## Design System

### Typography
- **Font Family**: Helvetica Neue
- **Title Weight**: 500 (medium)
- **Body Weight**: 400 (regular)

### Opacity Hierarchy
- **Primary Text**: 100% opacity (white)
- **Secondary Text**: 50% opacity (white)

### Border System
- **Thickness**: 2.5px consistently
- **Color**: White at 10% opacity
- **Radius**: 25px (rounded-3xl) for luxury pill shape

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is proprietary and confidential.

## Support

For support and questions, please open an issue in the GitHub repository.
# Spaceport CRM - Live Demo
