import * as cdk from "aws-cdk-lib"
import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as apigateway from "aws-cdk-lib/aws-apigateway"
import * as cognito from "aws-cdk-lib/aws-cognito"
import * as iam from "aws-cdk-lib/aws-iam"
import type { Construct } from "constructs"

export class SpaceportCrmStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // DynamoDB Tables
    const leadsTable = new dynamodb.Table(this, "LeadsTable", {
      tableName: "spaceport-crm-leads",
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    })

    const activitiesTable = new dynamodb.Table(this, "ActivitiesTable", {
      tableName: "spaceport-crm-activities",
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    })

    // Add GSI for querying activities by lead ID
    activitiesTable.addGlobalSecondaryIndex({
      indexName: "LeadIdIndex",
      partitionKey: { name: "leadId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.NUMBER },
    })

    // Cognito User Pool
    const userPool = new cognito.UserPool(this, "SpaceportCrmUserPool", {
      userPoolName: "spaceport-crm-users",
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        givenName: { required: true, mutable: true },
        familyName: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    const userPoolClient = new cognito.UserPoolClient(this, "SpaceportCrmUserPoolClient", {
      userPool,
      generateSecret: false,
      authFlows: {
        adminUserPassword: true,
        custom: true,
        userSrp: true,
      },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
      },
    })

    // Lambda execution role
    const lambdaRole = new iam.Role(this, "LambdaExecutionRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")],
    })

    // Lambda Functions with enhanced user attribution
    const leadsLambda = new lambda.Function(this, "LeadsFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const dynamodb = new AWS.DynamoDB.DocumentClient();
        
        const corsHeaders = {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        };
        
        // Helper function to extract user info from JWT token
        function getUserFromToken(authHeader) {
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
          }
          
          try {
            const token = authHeader.substring(7);
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            return {
              id: payload.sub,
              email: payload.email,
              name: payload.name || payload.email?.split('@')[0] || 'User'
            };
          } catch (error) {
            console.error('Error parsing token:', error);
            return null;
          }
        }
        
        exports.handler = async (event) => {
          console.log('Event:', JSON.stringify(event, null, 2));
          
          if (event.httpMethod === 'OPTIONS') {
            return { 
              statusCode: 200, 
              headers: corsHeaders,
              body: JSON.stringify({ message: 'CORS preflight' })
            };
          }
          
          try {
            const { httpMethod, pathParameters, body, headers } = event;
            const leadsTableName = process.env.LEADS_TABLE_NAME;
            const user = getUserFromToken(headers.Authorization || headers.authorization);
            
            switch (httpMethod) {
              case 'GET':
                if (pathParameters && pathParameters.id) {
                  // Get single lead
                  const result = await dynamodb.get({
                    TableName: leadsTableName,
                    Key: { id: pathParameters.id }
                  }).promise();
                  
                  return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify(result.Item || null)
                  };
                } else {
                  // Get all leads
                  const result = await dynamodb.scan({
                    TableName: leadsTableName
                  }).promise();
                  
                  return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify(result.Items || [])
                  };
                }
              
              case 'POST':
                const newLead = JSON.parse(body);
                newLead.id = \`lead_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
                newLead.createdAt = new Date().toISOString();
                newLead.updatedAt = new Date().toISOString();
                newLead.notes = newLead.notes || [];
                
                // Add user attribution
                if (user) {
                  newLead.createdBy = user.id;
                  newLead.createdByName = user.name;
                }
                
                await dynamodb.put({
                  TableName: leadsTableName,
                  Item: newLead
                }).promise();
                
                return {
                  statusCode: 201,
                  headers: corsHeaders,
                  body: JSON.stringify(newLead)
                };
              
              case 'PUT':
                const updatedLead = JSON.parse(body);
                updatedLead.updatedAt = new Date().toISOString();
                
                // Add user attribution for updates
                if (user) {
                  updatedLead.lastUpdatedBy = user.id;
                  updatedLead.lastUpdatedByName = user.name;
                }
                
                await dynamodb.put({
                  TableName: leadsTableName,
                  Item: updatedLead
                }).promise();
                
                return {
                  statusCode: 200,
                  headers: corsHeaders,
                  body: JSON.stringify(updatedLead)
                };
              
              case 'DELETE':
                if (!pathParameters || !pathParameters.id) {
                  return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'Lead ID is required' })
                  };
                }
                
                await dynamodb.delete({
                  TableName: leadsTableName,
                  Key: { id: pathParameters.id }
                }).promise();
                
                return {
                  statusCode: 204,
                  headers: corsHeaders,
                  body: ''
                };
              
              default:
                return {
                  statusCode: 405,
                  headers: corsHeaders,
                  body: JSON.stringify({ error: 'Method not allowed' })
                };
            }
          } catch (error) {
            console.error('Error:', error);
            return {
              statusCode: 500,
              headers: corsHeaders,
              body: JSON.stringify({ 
                error: 'Internal server error',
                message: error.message 
              })
            };
          }
        };
      `),
      environment: {
        LEADS_TABLE_NAME: leadsTable.tableName,
        ACTIVITIES_TABLE_NAME: activitiesTable.tableName,
        USER_POOL_ID: userPool.userPoolId,
      },
    })

    const activitiesLambda = new lambda.Function(this, "ActivitiesFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const dynamodb = new AWS.DynamoDB.DocumentClient();
        
        const corsHeaders = {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        };
        
        // Helper function to extract user info from JWT token
        function getUserFromToken(authHeader) {
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
          }
          
          try {
            const token = authHeader.substring(7);
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            return {
              id: payload.sub,
              email: payload.email,
              name: payload.name || payload.email?.split('@')[0] || 'User'
            };
          } catch (error) {
            console.error('Error parsing token:', error);
            return null;
          }
        }
        
        exports.handler = async (event) => {
          console.log('Event:', JSON.stringify(event, null, 2));
          
          if (event.httpMethod === 'OPTIONS') {
            return { 
              statusCode: 200, 
              headers: corsHeaders,
              body: JSON.stringify({ message: 'CORS preflight' })
            };
          }
          
          try {
            const { httpMethod, queryStringParameters, body, headers } = event;
            const activitiesTableName = process.env.ACTIVITIES_TABLE_NAME;
            const user = getUserFromToken(headers.Authorization || headers.authorization);
            
            switch (httpMethod) {
              case 'GET':
                if (queryStringParameters && queryStringParameters.leadId) {
                  // Get activities for a specific lead
                  const result = await dynamodb.query({
                    TableName: activitiesTableName,
                    IndexName: 'LeadIdIndex',
                    KeyConditionExpression: 'leadId = :leadId',
                    ExpressionAttributeValues: {
                      ':leadId': queryStringParameters.leadId
                    },
                    ScanIndexForward: false // Most recent first
                  }).promise();
                  
                  return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify(result.Items || [])
                  };
                } else {
                  // Get all activities
                  const result = await dynamodb.scan({
                    TableName: activitiesTableName
                  }).promise();
                  
                  return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify(result.Items || [])
                  };
                }
              
              case 'POST':
                const newActivity = JSON.parse(body);
                newActivity.id = \`activity_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
                newActivity.timestamp = Date.now();
                newActivity.createdAt = new Date().toISOString();
                
                // Add user attribution
                if (user) {
                  newActivity.createdBy = user.id;
                  newActivity.createdByName = user.name;
                }
                
                await dynamodb.put({
                  TableName: activitiesTableName,
                  Item: newActivity
                }).promise();
                
                return {
                  statusCode: 201,
                  headers: corsHeaders,
                  body: JSON.stringify(newActivity)
                };
              
              default:
                return {
                  statusCode: 405,
                  headers: corsHeaders,
                  body: JSON.stringify({ error: 'Method not allowed' })
                };
            }
          } catch (error) {
            console.error('Error:', error);
            return {
              statusCode: 500,
              headers: corsHeaders,
              body: JSON.stringify({ 
                error: 'Internal server error',
                message: error.message 
              })
            };
          }
        };
      `),
      environment: {
        LEADS_TABLE_NAME: leadsTable.tableName,
        ACTIVITIES_TABLE_NAME: activitiesTable.tableName,
        USER_POOL_ID: userPool.userPoolId,
      },
    })

    // Grant permissions
    leadsTable.grantReadWriteData(leadsLambda)
    activitiesTable.grantReadWriteData(leadsLambda)
    activitiesTable.grantReadWriteData(activitiesLambda)

    // API Gateway with Cognito Authorizer
    const api = new apigateway.RestApi(this, "SpaceportCrmApi", {
      restApiName: "Spaceport CRM API",
      description: "API for Spaceport CRM application",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ["Content-Type", "Authorization", "X-Amz-Date", "X-Api-Key", "X-Amz-Security-Token"],
      },
      deployOptions: {
        stageName: "prod",
        throttle: {
          rateLimit: 1000,
          burstLimit: 2000,
        },
      },
    })

    // Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, "CognitoAuthorizer", {
      cognitoUserPools: [userPool],
      identitySource: "method.request.header.Authorization",
    })

    // API Resources
    const leadsResource = api.root.addResource("leads")
    const leadResource = leadsResource.addResource("{id}")
    const activitiesResource = api.root.addResource("activities")

    // API Methods with Cognito authorization
    const methodOptions = {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      methodResponses: [
        {
          statusCode: "200",
          responseHeaders: {
            "Access-Control-Allow-Origin": true,
            "Access-Control-Allow-Headers": true,
            "Access-Control-Allow-Methods": true,
          },
        },
      ],
    }

    leadsResource.addMethod("GET", new apigateway.LambdaIntegration(leadsLambda), methodOptions)
    leadsResource.addMethod("POST", new apigateway.LambdaIntegration(leadsLambda), methodOptions)
    leadResource.addMethod("GET", new apigateway.LambdaIntegration(leadsLambda), methodOptions)
    leadResource.addMethod("PUT", new apigateway.LambdaIntegration(leadsLambda), methodOptions)
    leadResource.addMethod("DELETE", new apigateway.LambdaIntegration(leadsLambda), methodOptions)

    activitiesResource.addMethod("GET", new apigateway.LambdaIntegration(activitiesLambda), methodOptions)
    activitiesResource.addMethod("POST", new apigateway.LambdaIntegration(activitiesLambda), methodOptions)

    // Outputs
    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url,
      description: "API Gateway URL",
      exportName: "SpaceportCrmApiUrl",
    })

    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
      description: "Cognito User Pool ID",
      exportName: "SpaceportCrmUserPoolId",
    })

    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
      description: "Cognito User Pool Client ID",
      exportName: "SpaceportCrmUserPoolClientId",
    })

    new cdk.CfnOutput(this, "Region", {
      value: this.region,
      description: "AWS Region",
      exportName: "SpaceportCrmRegion",
    })

    new cdk.CfnOutput(this, "LeadsTableName", {
      value: leadsTable.tableName,
      description: "DynamoDB Leads Table Name",
      exportName: "SpaceportCrmLeadsTable",
    })

    new cdk.CfnOutput(this, "ActivitiesTableName", {
      value: activitiesTable.tableName,
      description: "DynamoDB Activities Table Name",
      exportName: "SpaceportCrmActivitiesTable",
    })
  }
}
