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

    const prospectsTable = new dynamodb.Table(this, "ProspectsTable", {
      tableName: "spaceport-crm-prospects",
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
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
        // Use AWS SDK v3 instead of deprecated aws-sdk
        const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
        
        // Initialize DynamoDB client with v3 SDK
        const client = new DynamoDBClient({});
        const dynamodb = DynamoDBDocumentClient.from(client);
        
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
            const { httpMethod, pathParameters, body, headers, resource } = event;
            const leadsTableName = process.env.LEADS_TABLE_NAME;
            const prospectsTableName = process.env.PROSPECTS_TABLE_NAME;
            const user = getUserFromToken(headers.Authorization || headers.authorization);
            
            // Determine if this is a leads or prospects request
            const isProspectsRequest = resource && resource.includes('/prospects');
            const tableName = isProspectsRequest ? prospectsTableName : leadsTableName;
            
            switch (httpMethod) {
              case 'GET':
                if (pathParameters && pathParameters.id) {
                  // Get single item with strong consistency
                  const result = await dynamodb.send(new GetCommand({
                    TableName: tableName,
                    Key: { id: pathParameters.id },
                    ConsistentRead: true // Force strong consistency for immediate read-after-write
                  }));
                  
                  return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify(result.Item || null)
                  };
                } else {
                  // Get all items with strong consistency for immediate read-after-write
                  const result = await dynamodb.send(new ScanCommand({
                    TableName: tableName,
                    ConsistentRead: true // Force strong consistency to eliminate eventual consistency delays
                  }));
                  
                  return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify(result.Items || [])
                  };
                }
              
              case 'POST':
                const newItem = JSON.parse(body);
                const itemType = isProspectsRequest ? 'prospect' : 'lead';
                newItem.id = \`\${itemType}_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
                newItem.createdAt = new Date().toISOString();
                newItem.updatedAt = new Date().toISOString();
                
                // Add user attribution
                if (user) {
                  newItem.createdBy = user.id;
                  newItem.createdByName = user.name;
                  newItem.lastUpdatedBy = user.id;
                  newItem.lastUpdatedByName = user.name;
                }
                
                await dynamodb.send(new PutCommand({
                  TableName: tableName,
                  Item: newItem
                }));
                
                return {
                  statusCode: 201,
                  headers: corsHeaders,
                  body: JSON.stringify(newItem)
                };
              
              case 'PUT':
                if (!pathParameters || !pathParameters.id) {
                  return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'Lead ID required' })
                  };
                }
                
                const updateData = JSON.parse(body);
                delete updateData.id; // Don't allow ID updates
                
                // Add user attribution for updates
                if (user) {
                  updateData.lastModifiedBy = user.id;
                  updateData.lastModifiedByName = user.name;
                  updateData.lastModified = new Date().toISOString();
                }
                
                // Build update expression
                const updateExpression = [];
                const expressionAttributeValues = {};
                const expressionAttributeNames = {};
                
                Object.keys(updateData).forEach((key, index) => {
                  const attrName = \`#attr\${index}\`;
                  const attrValue = \`:val\${index}\`;
                  updateExpression.push(\`\${attrName} = \${attrValue}\`);
                  expressionAttributeNames[attrName] = key;
                  expressionAttributeValues[attrValue] = updateData[key];
                });
                
                const result = await dynamodb.send(new UpdateCommand({
                  TableName: tableName,
                  Key: { id: pathParameters.id },
                  UpdateExpression: \`SET \${updateExpression.join(', ')}\`,
                  ExpressionAttributeNames: expressionAttributeNames,
                  ExpressionAttributeValues: expressionAttributeValues,
                  ReturnValues: 'ALL_NEW'
                }));
                
                return {
                  statusCode: 200,
                  headers: corsHeaders,
                  body: JSON.stringify(result.Attributes)
                };
              
              case 'DELETE':
                if (pathParameters && pathParameters.id === 'reset') {
                  // Reset/clear all items (special endpoint)
                  const scanResult = await dynamodb.send(new ScanCommand({
                    TableName: tableName,
                    ProjectionExpression: 'id'
                  }));
                  
                  // Delete all items
                  for (const item of scanResult.Items || []) {
                    await dynamodb.send(new DeleteCommand({
                      TableName: tableName,
                      Key: { id: item.id }
                    }));
                  }
                  
                  const itemType = isProspectsRequest ? 'prospects' : 'leads';
                  return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ message: \`Deleted \${scanResult.Items?.length || 0} \${itemType}\` })
                  };
                } else if (pathParameters && pathParameters.id) {
                  // Delete single item
                  await dynamodb.send(new DeleteCommand({
                    TableName: tableName,
                    Key: { id: pathParameters.id }
                  }));
                  
                  return {
                    statusCode: 204,
                    headers: corsHeaders,
                    body: ''
                  };
                } else {
                  const itemType = isProspectsRequest ? 'prospect' : 'lead';
                  return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: \`\${itemType.charAt(0).toUpperCase() + itemType.slice(1)} ID required\` })
                  };
                }
              
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
        PROSPECTS_TABLE_NAME: prospectsTable.tableName,
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
        // Use AWS SDK v3 instead of deprecated aws-sdk
        const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, ScanCommand, QueryCommand, PutCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
        
        // Initialize DynamoDB client with v3 SDK
        const client = new DynamoDBClient({});
        const dynamodb = DynamoDBDocumentClient.from(client);
        
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
                  const result = await dynamodb.send(new QueryCommand({
                    TableName: activitiesTableName,
                    IndexName: 'LeadIdIndex',
                    KeyConditionExpression: 'leadId = :leadId',
                    ExpressionAttributeValues: {
                      ':leadId': queryStringParameters.leadId
                    },
                    ScanIndexForward: false // Most recent first
                  }));
                  
                  return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify(result.Items || [])
                  };
                } else {
                  // Get all activities
                  const result = await dynamodb.send(new ScanCommand({
                    TableName: activitiesTableName
                  }));
                  
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
                
                await dynamodb.send(new PutCommand({
                  TableName: activitiesTableName,
                  Item: newActivity
                }));
                
                return {
                  statusCode: 201,
                  headers: corsHeaders,
                  body: JSON.stringify(newActivity)
                };
              
              case 'DELETE':
                // Reset/clear all activities (special endpoint)
                const scanResult = await dynamodb.send(new ScanCommand({
                  TableName: activitiesTableName,
                  ProjectionExpression: 'id'
                }));
                
                // Delete all activities
                for (const item of scanResult.Items || []) {
                  await dynamodb.send(new DeleteCommand({
                    TableName: activitiesTableName,
                    Key: { id: item.id }
                  }));
                }
                
                return {
                  statusCode: 200,
                  headers: corsHeaders,
                  body: JSON.stringify({ message: \`Deleted \${scanResult.Items?.length || 0} activities\` })
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
    prospectsTable.grantReadWriteData(leadsLambda)

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
    const prospectsResource = api.root.addResource("prospects")
    const prospectResource = prospectsResource.addResource("{id}")

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
        {
          statusCode: "401", 
          responseHeaders: {
            "Access-Control-Allow-Origin": true,
            "Access-Control-Allow-Headers": true,
            "Access-Control-Allow-Methods": true,
          },
        },
        {
          statusCode: "403",
          responseHeaders: {
            "Access-Control-Allow-Origin": true,
            "Access-Control-Allow-Headers": true,
            "Access-Control-Allow-Methods": true,
          },
        },
        {
          statusCode: "500",
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
    activitiesResource.addMethod("DELETE", new apigateway.LambdaIntegration(activitiesLambda), methodOptions)
    activitiesResource.addMethod("OPTIONS", new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: "200",
        responseParameters: {
          "method.response.header.Access-Control-Allow-Headers": "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
          "method.response.header.Access-Control-Allow-Methods": "'GET,POST,PUT,DELETE,OPTIONS'",
          "method.response.header.Access-Control-Allow-Origin": "'*'",
        },
      }],
      requestTemplates: {
        "application/json": '{"statusCode": 200}',
      },
    }), {
      methodResponses: [{
        statusCode: "200",
        responseParameters: {
          "method.response.header.Access-Control-Allow-Headers": true,
          "method.response.header.Access-Control-Allow-Methods": true,
          "method.response.header.Access-Control-Allow-Origin": true,
        },
      }],
    })

    prospectsResource.addMethod("GET", new apigateway.LambdaIntegration(leadsLambda), methodOptions)
    prospectsResource.addMethod("POST", new apigateway.LambdaIntegration(leadsLambda), methodOptions)
    prospectResource.addMethod("GET", new apigateway.LambdaIntegration(leadsLambda), methodOptions)
    prospectResource.addMethod("PUT", new apigateway.LambdaIntegration(leadsLambda), methodOptions)
    prospectResource.addMethod("DELETE", new apigateway.LambdaIntegration(leadsLambda), methodOptions)

    // Add Gateway Responses for CORS support on authentication failures
    api.addGatewayResponse("AuthorizerFailure", {
      type: apigateway.ResponseType.UNAUTHORIZED,
      responseHeaders: {
        "Access-Control-Allow-Origin": "'*'",
        "Access-Control-Allow-Headers": "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
        "Access-Control-Allow-Methods": "'GET,POST,PUT,DELETE,OPTIONS'",
      },
    })

    api.addGatewayResponse("AuthorizerConfigurationError", {
      type: apigateway.ResponseType.AUTHORIZER_CONFIGURATION_ERROR,
      responseHeaders: {
        "Access-Control-Allow-Origin": "'*'",
        "Access-Control-Allow-Headers": "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
        "Access-Control-Allow-Methods": "'GET,POST,PUT,DELETE,OPTIONS'",
      },
    })

    api.addGatewayResponse("AuthorizerResultTtlInSecondsFailure", {
      type: apigateway.ResponseType.AUTHORIZER_FAILURE,
      responseHeaders: {
        "Access-Control-Allow-Origin": "'*'",
        "Access-Control-Allow-Headers": "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
        "Access-Control-Allow-Methods": "'GET,POST,PUT,DELETE,OPTIONS'",
      },
    })

    api.addGatewayResponse("AccessDenied", {
      type: apigateway.ResponseType.ACCESS_DENIED,
      responseHeaders: {
        "Access-Control-Allow-Origin": "'*'",
        "Access-Control-Allow-Headers": "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
        "Access-Control-Allow-Methods": "'GET,POST,PUT,DELETE,OPTIONS'",
      },
    })

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
