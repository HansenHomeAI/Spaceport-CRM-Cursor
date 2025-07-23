#!/bin/bash

# Spaceport CRM Deployment Script
# This script deploys the CDK infrastructure and sets up environment variables

set -e

echo "🚀 Starting Spaceport CRM deployment..."

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI is not configured. Please run 'aws configure' first."
    exit 1
fi

# Check if CDK is installed
if ! command -v cdk &> /dev/null; then
    echo "❌ AWS CDK is not installed. Please install it first: npm install -g aws-cdk"
    exit 1
fi

# Navigate to CDK directory
cd cdk

echo "📦 Installing CDK dependencies..."
npm install

echo "🔧 Deploying CDK infrastructure..."
cdk deploy --require-approval never

echo "📋 Getting deployment outputs..."
cdk output --json > ../deployment-outputs.json

echo "✅ CDK deployment complete!"

# Parse outputs and create environment file
echo "🔧 Creating environment variables..."
cd ..

# Extract values from CDK output
API_URL=$(node -e "console.log(JSON.parse(require('fs').readFileSync('deployment-outputs.json')).SpaceportCrmStack.ApiUrl)")
USER_POOL_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('deployment-outputs.json')).SpaceportCrmStack.UserPoolId)")
USER_POOL_CLIENT_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('deployment-outputs.json')).SpaceportCrmStack.UserPoolClientId)")
REGION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('deployment-outputs.json')).SpaceportCrmStack.Region)")

# Create .env.local file
cat > .env.local << EOF
# AWS Configuration
NEXT_PUBLIC_AWS_REGION=${REGION}
NEXT_PUBLIC_USER_POOL_ID=${USER_POOL_ID}
NEXT_PUBLIC_USER_POOL_CLIENT_ID=${USER_POOL_CLIENT_ID}
NEXT_PUBLIC_API_URL=${API_URL}

# Development mode (set to false for production)
NEXT_PUBLIC_DEV_MODE=false
EOF

echo "✅ Environment variables created in .env.local"
echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Review the .env.local file"
echo "2. Test the application locally: npm run dev"
echo "3. Build for production: npm run build"
echo "4. Deploy to your hosting platform"
echo ""
echo "🔗 API URL: ${API_URL}"
echo "👥 User Pool ID: ${USER_POOL_ID}"
echo "🌍 Region: ${REGION}"
echo ""
echo "⚠️  Important: Make sure to set these environment variables in your production hosting platform!" 