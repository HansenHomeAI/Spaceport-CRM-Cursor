"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpaceportCrmStack = void 0;
const cdk = require("aws-cdk-lib");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const lambda = require("aws-cdk-lib/aws-lambda");
const apigateway = require("aws-cdk-lib/aws-apigateway");
const cognito = require("aws-cdk-lib/aws-cognito");
const iam = require("aws-cdk-lib/aws-iam");
class SpaceportCrmStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // DynamoDB Tables
        const leadsTable = new dynamodb.Table(this, "LeadsTable", {
            tableName: "spaceport-crm-leads",
            partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            pointInTimeRecovery: true,
        });
        const activitiesTable = new dynamodb.Table(this, "ActivitiesTable", {
            tableName: "spaceport-crm-activities",
            partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "timestamp", type: dynamodb.AttributeType.NUMBER },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            pointInTimeRecovery: true,
        });
        // Add GSI for querying activities by lead ID
        activitiesTable.addGlobalSecondaryIndex({
            indexName: "LeadIdIndex",
            partitionKey: { name: "leadId", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "timestamp", type: dynamodb.AttributeType.NUMBER },
        });
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
        });
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
        });
        // Lambda execution role
        const lambdaRole = new iam.Role(this, "LambdaExecutionRole", {
            assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
            managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")],
        });
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
            const { httpMethod, pathParameters, body, headers } = event;
            const leadsTableName = process.env.LEADS_TABLE_NAME;
            const user = getUserFromToken(headers.Authorization || headers.authorization);
            
            switch (httpMethod) {
              case 'GET':
                if (pathParameters && pathParameters.id) {
                  // Get single lead
                  const result = await dynamodb.send(new GetCommand({
                    TableName: leadsTableName,
                    Key: { id: pathParameters.id }
                  }));
                  
                  return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify(result.Item || null)
                  };
                } else {
                  // Get all leads
                  const result = await dynamodb.send(new ScanCommand({
                    TableName: leadsTableName
                  }));
                  
                  return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify(result.Items || [])
                  };
                }
              
              case 'POST':
                const newLead = JSON.parse(body);
                newLead.id = \`lead_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
                newLead.dateAdded = new Date().toISOString();
                newLead.lastContact = newLead.lastContact || new Date().toISOString();
                
                // Add user attribution
                if (user) {
                  newLead.createdBy = user.id;
                  newLead.createdByName = user.name;
                }
                
                await dynamodb.send(new PutCommand({
                  TableName: leadsTableName,
                  Item: newLead
                }));
                
                return {
                  statusCode: 201,
                  headers: corsHeaders,
                  body: JSON.stringify(newLead)
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
                  TableName: leadsTableName,
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
                  // Reset/clear all leads (special endpoint)
                  const scanResult = await dynamodb.send(new ScanCommand({
                    TableName: leadsTableName,
                    ProjectionExpression: 'id'
                  }));
                  
                  // Delete all items
                  for (const item of scanResult.Items || []) {
                    await dynamodb.send(new DeleteCommand({
                      TableName: leadsTableName,
                      Key: { id: item.id }
                    }));
                  }
                  
                  return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ message: \`Deleted \${scanResult.Items?.length || 0} leads\` })
                  };
                } else if (pathParameters && pathParameters.id) {
                  // Delete single lead
                  await dynamodb.send(new DeleteCommand({
                    TableName: leadsTableName,
                    Key: { id: pathParameters.id }
                  }));
                  
                  return {
                    statusCode: 204,
                    headers: corsHeaders,
                    body: ''
                  };
                } else {
                  return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'Lead ID required' })
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
                ACTIVITIES_TABLE_NAME: activitiesTable.tableName,
                USER_POOL_ID: userPool.userPoolId,
            },
        });
        const activitiesLambda = new lambda.Function(this, "ActivitiesFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: "index.handler",
            role: lambdaRole,
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            code: lambda.Code.fromInline(`
        // Use AWS SDK v3 instead of deprecated aws-sdk
        const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, ScanCommand, QueryCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
        
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
        });
        // Grant permissions
        leadsTable.grantReadWriteData(leadsLambda);
        activitiesTable.grantReadWriteData(leadsLambda);
        activitiesTable.grantReadWriteData(activitiesLambda);
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
        });
        // Cognito Authorizer
        const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, "CognitoAuthorizer", {
            cognitoUserPools: [userPool],
            identitySource: "method.request.header.Authorization",
        });
        // API Resources
        const leadsResource = api.root.addResource("leads");
        const leadResource = leadsResource.addResource("{id}");
        const activitiesResource = api.root.addResource("activities");
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
        };
        leadsResource.addMethod("GET", new apigateway.LambdaIntegration(leadsLambda), methodOptions);
        leadsResource.addMethod("POST", new apigateway.LambdaIntegration(leadsLambda), methodOptions);
        leadResource.addMethod("GET", new apigateway.LambdaIntegration(leadsLambda), methodOptions);
        leadResource.addMethod("PUT", new apigateway.LambdaIntegration(leadsLambda), methodOptions);
        leadResource.addMethod("DELETE", new apigateway.LambdaIntegration(leadsLambda), methodOptions);
        activitiesResource.addMethod("GET", new apigateway.LambdaIntegration(activitiesLambda), methodOptions);
        activitiesResource.addMethod("POST", new apigateway.LambdaIntegration(activitiesLambda), methodOptions);
        // Add Gateway Responses for CORS support on authentication failures
        api.addGatewayResponse("AuthorizerFailure", {
            type: apigateway.ResponseType.UNAUTHORIZED,
            responseHeaders: {
                "Access-Control-Allow-Origin": "'*'",
                "Access-Control-Allow-Headers": "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
                "Access-Control-Allow-Methods": "'GET,POST,PUT,DELETE,OPTIONS'",
            },
        });
        api.addGatewayResponse("AuthorizerConfigurationError", {
            type: apigateway.ResponseType.AUTHORIZER_CONFIGURATION_ERROR,
            responseHeaders: {
                "Access-Control-Allow-Origin": "'*'",
                "Access-Control-Allow-Headers": "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
                "Access-Control-Allow-Methods": "'GET,POST,PUT,DELETE,OPTIONS'",
            },
        });
        api.addGatewayResponse("AuthorizerResultTtlInSecondsFailure", {
            type: apigateway.ResponseType.AUTHORIZER_FAILURE,
            responseHeaders: {
                "Access-Control-Allow-Origin": "'*'",
                "Access-Control-Allow-Headers": "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
                "Access-Control-Allow-Methods": "'GET,POST,PUT,DELETE,OPTIONS'",
            },
        });
        api.addGatewayResponse("AccessDenied", {
            type: apigateway.ResponseType.ACCESS_DENIED,
            responseHeaders: {
                "Access-Control-Allow-Origin": "'*'",
                "Access-Control-Allow-Headers": "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
                "Access-Control-Allow-Methods": "'GET,POST,PUT,DELETE,OPTIONS'",
            },
        });
        // Outputs
        new cdk.CfnOutput(this, "ApiUrl", {
            value: api.url,
            description: "API Gateway URL",
            exportName: "SpaceportCrmApiUrl",
        });
        new cdk.CfnOutput(this, "UserPoolId", {
            value: userPool.userPoolId,
            description: "Cognito User Pool ID",
            exportName: "SpaceportCrmUserPoolId",
        });
        new cdk.CfnOutput(this, "UserPoolClientId", {
            value: userPoolClient.userPoolClientId,
            description: "Cognito User Pool Client ID",
            exportName: "SpaceportCrmUserPoolClientId",
        });
        new cdk.CfnOutput(this, "Region", {
            value: this.region,
            description: "AWS Region",
            exportName: "SpaceportCrmRegion",
        });
        new cdk.CfnOutput(this, "LeadsTableName", {
            value: leadsTable.tableName,
            description: "DynamoDB Leads Table Name",
            exportName: "SpaceportCrmLeadsTable",
        });
        new cdk.CfnOutput(this, "ActivitiesTableName", {
            value: activitiesTable.tableName,
            description: "DynamoDB Activities Table Name",
            exportName: "SpaceportCrmActivitiesTable",
        });
    }
}
exports.SpaceportCrmStack = SpaceportCrmStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3BhY2Vwb3J0LWNybS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNwYWNlcG9ydC1jcm0tc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQWtDO0FBQ2xDLHFEQUFvRDtBQUNwRCxpREFBZ0Q7QUFDaEQseURBQXdEO0FBQ3hELG1EQUFrRDtBQUNsRCwyQ0FBMEM7QUFHMUMsTUFBYSxpQkFBa0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQUM5QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzlELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFBO1FBRXZCLGtCQUFrQjtRQUNsQixNQUFNLFVBQVUsR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUN4RCxTQUFTLEVBQUUscUJBQXFCO1lBQ2hDLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ2pFLFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTTtZQUN2QyxtQkFBbUIsRUFBRSxJQUFJO1NBQzFCLENBQUMsQ0FBQTtRQUVGLE1BQU0sZUFBZSxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFDbEUsU0FBUyxFQUFFLDBCQUEwQjtZQUNyQyxZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUNqRSxPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUNuRSxXQUFXLEVBQUUs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QUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7WUFDeEMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxTQUFTO1lBQzNCLFdBQVcsRUFBRSwyQkFBMkI7WUFDeEMsVUFBVSxFQUFFLHdCQUF3QjtTQUNyQyxDQUFDLENBQUE7UUFFRixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQzdDLEtBQUssRUFBRSxlQUFlLENBQUMsU0FBUztZQUNoQyxXQUFXLEVBQUUsZ0NBQWdDO1lBQzdDLFVBQVUsRUFBRSw2QkFBNkI7U0FDMUMsQ0FBQyxDQUFBO0lBQ0osQ0FBQztDQUNGO0FBMWtCRCw4Q0Ewa0JDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gXCJhd3MtY2RrLWxpYlwiXG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiXCJcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWxhbWJkYVwiXG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheVwiXG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtY29nbml0b1wiXG5pbXBvcnQgKiBhcyBpYW0gZnJvbSBcImF3cy1jZGstbGliL2F3cy1pYW1cIlxuaW1wb3J0IHR5cGUgeyBDb25zdHJ1Y3QgfSBmcm9tIFwiY29uc3RydWN0c1wiXG5cbmV4cG9ydCBjbGFzcyBTcGFjZXBvcnRDcm1TdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKVxuXG4gICAgLy8gRHluYW1vREIgVGFibGVzXG4gICAgY29uc3QgbGVhZHNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCBcIkxlYWRzVGFibGVcIiwge1xuICAgICAgdGFibGVOYW1lOiBcInNwYWNlcG9ydC1jcm0tbGVhZHNcIixcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiBcImlkXCIsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogdHJ1ZSxcbiAgICB9KVxuXG4gICAgY29uc3QgYWN0aXZpdGllc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsIFwiQWN0aXZpdGllc1RhYmxlXCIsIHtcbiAgICAgIHRhYmxlTmFtZTogXCJzcGFjZXBvcnQtY3JtLWFjdGl2aXRpZXNcIixcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiBcImlkXCIsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6IFwidGltZXN0YW1wXCIsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogdHJ1ZSxcbiAgICB9KVxuXG4gICAgLy8gQWRkIEdTSSBmb3IgcXVlcnlpbmcgYWN0aXZpdGllcyBieSBsZWFkIElEXG4gICAgYWN0aXZpdGllc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogXCJMZWFkSWRJbmRleFwiLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6IFwibGVhZElkXCIsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6IFwidGltZXN0YW1wXCIsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSIH0sXG4gICAgfSlcblxuICAgIC8vIENvZ25pdG8gVXNlciBQb29sXG4gICAgY29uc3QgdXNlclBvb2wgPSBuZXcgY29nbml0by5Vc2VyUG9vbCh0aGlzLCBcIlNwYWNlcG9ydENybVVzZXJQb29sXCIsIHtcbiAgICAgIHVzZXJQb29sTmFtZTogXCJzcGFjZXBvcnQtY3JtLXVzZXJzXCIsXG4gICAgICBzZWxmU2lnblVwRW5hYmxlZDogdHJ1ZSxcbiAgICAgIHNpZ25JbkFsaWFzZXM6IHsgZW1haWw6IHRydWUgfSxcbiAgICAgIGF1dG9WZXJpZnk6IHsgZW1haWw6IHRydWUgfSxcbiAgICAgIHN0YW5kYXJkQXR0cmlidXRlczoge1xuICAgICAgICBlbWFpbDogeyByZXF1aXJlZDogdHJ1ZSwgbXV0YWJsZTogdHJ1ZSB9LFxuICAgICAgICBnaXZlbk5hbWU6IHsgcmVxdWlyZWQ6IHRydWUsIG11dGFibGU6IHRydWUgfSxcbiAgICAgICAgZmFtaWx5TmFtZTogeyByZXF1aXJlZDogdHJ1ZSwgbXV0YWJsZTogdHJ1ZSB9LFxuICAgICAgfSxcbiAgICAgIHBhc3N3b3JkUG9saWN5OiB7XG4gICAgICAgIG1pbkxlbmd0aDogOCxcbiAgICAgICAgcmVxdWlyZUxvd2VyY2FzZTogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZVVwcGVyY2FzZTogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZURpZ2l0czogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZVN5bWJvbHM6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIGFjY291bnRSZWNvdmVyeTogY29nbml0by5BY2NvdW50UmVjb3ZlcnkuRU1BSUxfT05MWSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICB9KVxuXG4gICAgY29uc3QgdXNlclBvb2xDbGllbnQgPSBuZXcgY29nbml0by5Vc2VyUG9vbENsaWVudCh0aGlzLCBcIlNwYWNlcG9ydENybVVzZXJQb29sQ2xpZW50XCIsIHtcbiAgICAgIHVzZXJQb29sLFxuICAgICAgZ2VuZXJhdGVTZWNyZXQ6IGZhbHNlLFxuICAgICAgYXV0aEZsb3dzOiB7XG4gICAgICAgIGFkbWluVXNlclBhc3N3b3JkOiB0cnVlLFxuICAgICAgICBjdXN0b206IHRydWUsXG4gICAgICAgIHVzZXJTcnA6IHRydWUsXG4gICAgICB9LFxuICAgICAgb0F1dGg6IHtcbiAgICAgICAgZmxvd3M6IHsgYXV0aG9yaXphdGlvbkNvZGVHcmFudDogdHJ1ZSB9LFxuICAgICAgICBzY29wZXM6IFtjb2duaXRvLk9BdXRoU2NvcGUuRU1BSUwsIGNvZ25pdG8uT0F1dGhTY29wZS5PUEVOSUQsIGNvZ25pdG8uT0F1dGhTY29wZS5QUk9GSUxFXSxcbiAgICAgIH0sXG4gICAgfSlcblxuICAgIC8vIExhbWJkYSBleGVjdXRpb24gcm9sZVxuICAgIGNvbnN0IGxhbWJkYVJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgXCJMYW1iZGFFeGVjdXRpb25Sb2xlXCIsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKFwibGFtYmRhLmFtYXpvbmF3cy5jb21cIiksXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoXCJzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlXCIpXSxcbiAgICB9KVxuXG4gICAgLy8gTGFtYmRhIEZ1bmN0aW9ucyB3aXRoIGVuaGFuY2VkIHVzZXIgYXR0cmlidXRpb25cbiAgICBjb25zdCBsZWFkc0xhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgXCJMZWFkc0Z1bmN0aW9uXCIsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogXCJpbmRleC5oYW5kbGVyXCIsXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgIC8vIFVzZSBBV1MgU0RLIHYzIGluc3RlYWQgb2YgZGVwcmVjYXRlZCBhd3Mtc2RrXG4gICAgICAgIGNvbnN0IHsgRHluYW1vREJDbGllbnQgfSA9IHJlcXVpcmUoJ0Bhd3Mtc2RrL2NsaWVudC1keW5hbW9kYicpO1xuICAgICAgICBjb25zdCB7IER5bmFtb0RCRG9jdW1lbnRDbGllbnQsIFNjYW5Db21tYW5kLCBHZXRDb21tYW5kLCBQdXRDb21tYW5kLCBVcGRhdGVDb21tYW5kLCBEZWxldGVDb21tYW5kIH0gPSByZXF1aXJlKCdAYXdzLXNkay9saWItZHluYW1vZGInKTtcbiAgICAgICAgXG4gICAgICAgIC8vIEluaXRpYWxpemUgRHluYW1vREIgY2xpZW50IHdpdGggdjMgU0RLXG4gICAgICAgIGNvbnN0IGNsaWVudCA9IG5ldyBEeW5hbW9EQkNsaWVudCh7fSk7XG4gICAgICAgIGNvbnN0IGR5bmFtb2RiID0gRHluYW1vREJEb2N1bWVudENsaWVudC5mcm9tKGNsaWVudCk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBjb3JzSGVhZGVycyA9IHtcbiAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogJyonLFxuICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogJ0NvbnRlbnQtVHlwZSxBdXRob3JpemF0aW9uJyxcbiAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6ICdHRVQsUE9TVCxQVVQsREVMRVRFLE9QVElPTlMnXG4gICAgICAgIH07XG4gICAgICAgIFxuICAgICAgICAvLyBIZWxwZXIgZnVuY3Rpb24gdG8gZXh0cmFjdCB1c2VyIGluZm8gZnJvbSBKV1QgdG9rZW5cbiAgICAgICAgZnVuY3Rpb24gZ2V0VXNlckZyb21Ub2tlbihhdXRoSGVhZGVyKSB7XG4gICAgICAgICAgaWYgKCFhdXRoSGVhZGVyIHx8ICFhdXRoSGVhZGVyLnN0YXJ0c1dpdGgoJ0JlYXJlciAnKSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB0b2tlbiA9IGF1dGhIZWFkZXIuc3Vic3RyaW5nKDcpO1xuICAgICAgICAgICAgY29uc3QgcGF5bG9hZCA9IEpTT04ucGFyc2UoQnVmZmVyLmZyb20odG9rZW4uc3BsaXQoJy4nKVsxXSwgJ2Jhc2U2NCcpLnRvU3RyaW5nKCkpO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgaWQ6IHBheWxvYWQuc3ViLFxuICAgICAgICAgICAgICBlbWFpbDogcGF5bG9hZC5lbWFpbCxcbiAgICAgICAgICAgICAgbmFtZTogcGF5bG9hZC5uYW1lIHx8IHBheWxvYWQuZW1haWw/LnNwbGl0KCdAJylbMF0gfHwgJ1VzZXInXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBwYXJzaW5nIHRva2VuOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ0V2ZW50OicsIEpTT04uc3RyaW5naWZ5KGV2ZW50LCBudWxsLCAyKSk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKGV2ZW50Lmh0dHBNZXRob2QgPT09ICdPUFRJT05TJykge1xuICAgICAgICAgICAgcmV0dXJuIHsgXG4gICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMCwgXG4gICAgICAgICAgICAgIGhlYWRlcnM6IGNvcnNIZWFkZXJzLFxuICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IG1lc3NhZ2U6ICdDT1JTIHByZWZsaWdodCcgfSlcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGh0dHBNZXRob2QsIHBhdGhQYXJhbWV0ZXJzLCBib2R5LCBoZWFkZXJzIH0gPSBldmVudDtcbiAgICAgICAgICAgIGNvbnN0IGxlYWRzVGFibGVOYW1lID0gcHJvY2Vzcy5lbnYuTEVBRFNfVEFCTEVfTkFNRTtcbiAgICAgICAgICAgIGNvbnN0IHVzZXIgPSBnZXRVc2VyRnJvbVRva2VuKGhlYWRlcnMuQXV0aG9yaXphdGlvbiB8fCBoZWFkZXJzLmF1dGhvcml6YXRpb24pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBzd2l0Y2ggKGh0dHBNZXRob2QpIHtcbiAgICAgICAgICAgICAgY2FzZSAnR0VUJzpcbiAgICAgICAgICAgICAgICBpZiAocGF0aFBhcmFtZXRlcnMgJiYgcGF0aFBhcmFtZXRlcnMuaWQpIHtcbiAgICAgICAgICAgICAgICAgIC8vIEdldCBzaW5nbGUgbGVhZFxuICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZHluYW1vZGIuc2VuZChuZXcgR2V0Q29tbWFuZCh7XG4gICAgICAgICAgICAgICAgICAgIFRhYmxlTmFtZTogbGVhZHNUYWJsZU5hbWUsXG4gICAgICAgICAgICAgICAgICAgIEtleTogeyBpZDogcGF0aFBhcmFtZXRlcnMuaWQgfVxuICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgICAgICAgICAgIGhlYWRlcnM6IGNvcnNIZWFkZXJzLFxuICAgICAgICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShyZXN1bHQuSXRlbSB8fCBudWxsKVxuICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgLy8gR2V0IGFsbCBsZWFkc1xuICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZHluYW1vZGIuc2VuZChuZXcgU2NhbkNvbW1hbmQoe1xuICAgICAgICAgICAgICAgICAgICBUYWJsZU5hbWU6IGxlYWRzVGFibGVOYW1lXG4gICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgICAgICAgICAgICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMsXG4gICAgICAgICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlc3VsdC5JdGVtcyB8fCBbXSlcbiAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgY2FzZSAnUE9TVCc6XG4gICAgICAgICAgICAgICAgY29uc3QgbmV3TGVhZCA9IEpTT04ucGFyc2UoYm9keSk7XG4gICAgICAgICAgICAgICAgbmV3TGVhZC5pZCA9IFxcYGxlYWRfXFwke0RhdGUubm93KCl9X1xcJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHIoMiwgOSl9XFxgO1xuICAgICAgICAgICAgICAgIG5ld0xlYWQuZGF0ZUFkZGVkID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICAgICAgICAgICAgICAgIG5ld0xlYWQubGFzdENvbnRhY3QgPSBuZXdMZWFkLmxhc3RDb250YWN0IHx8IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBBZGQgdXNlciBhdHRyaWJ1dGlvblxuICAgICAgICAgICAgICAgIGlmICh1c2VyKSB7XG4gICAgICAgICAgICAgICAgICBuZXdMZWFkLmNyZWF0ZWRCeSA9IHVzZXIuaWQ7XG4gICAgICAgICAgICAgICAgICBuZXdMZWFkLmNyZWF0ZWRCeU5hbWUgPSB1c2VyLm5hbWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGF3YWl0IGR5bmFtb2RiLnNlbmQobmV3IFB1dENvbW1hbmQoe1xuICAgICAgICAgICAgICAgICAgVGFibGVOYW1lOiBsZWFkc1RhYmxlTmFtZSxcbiAgICAgICAgICAgICAgICAgIEl0ZW06IG5ld0xlYWRcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMSxcbiAgICAgICAgICAgICAgICAgIGhlYWRlcnM6IGNvcnNIZWFkZXJzLFxuICAgICAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkobmV3TGVhZClcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgY2FzZSAnUFVUJzpcbiAgICAgICAgICAgICAgICBpZiAoIXBhdGhQYXJhbWV0ZXJzIHx8ICFwYXRoUGFyYW1ldGVycy5pZCkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogNDAwLFxuICAgICAgICAgICAgICAgICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycyxcbiAgICAgICAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ0xlYWQgSUQgcmVxdWlyZWQnIH0pXG4gICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBjb25zdCB1cGRhdGVEYXRhID0gSlNPTi5wYXJzZShib2R5KTtcbiAgICAgICAgICAgICAgICBkZWxldGUgdXBkYXRlRGF0YS5pZDsgLy8gRG9uJ3QgYWxsb3cgSUQgdXBkYXRlc1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIEFkZCB1c2VyIGF0dHJpYnV0aW9uIGZvciB1cGRhdGVzXG4gICAgICAgICAgICAgICAgaWYgKHVzZXIpIHtcbiAgICAgICAgICAgICAgICAgIHVwZGF0ZURhdGEubGFzdE1vZGlmaWVkQnkgPSB1c2VyLmlkO1xuICAgICAgICAgICAgICAgICAgdXBkYXRlRGF0YS5sYXN0TW9kaWZpZWRCeU5hbWUgPSB1c2VyLm5hbWU7XG4gICAgICAgICAgICAgICAgICB1cGRhdGVEYXRhLmxhc3RNb2RpZmllZCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gQnVpbGQgdXBkYXRlIGV4cHJlc3Npb25cbiAgICAgICAgICAgICAgICBjb25zdCB1cGRhdGVFeHByZXNzaW9uID0gW107XG4gICAgICAgICAgICAgICAgY29uc3QgZXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlcyA9IHt9O1xuICAgICAgICAgICAgICAgIGNvbnN0IGV4cHJlc3Npb25BdHRyaWJ1dGVOYW1lcyA9IHt9O1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIE9iamVjdC5rZXlzKHVwZGF0ZURhdGEpLmZvckVhY2goKGtleSwgaW5kZXgpID0+IHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGF0dHJOYW1lID0gXFxgI2F0dHJcXCR7aW5kZXh9XFxgO1xuICAgICAgICAgICAgICAgICAgY29uc3QgYXR0clZhbHVlID0gXFxgOnZhbFxcJHtpbmRleH1cXGA7XG4gICAgICAgICAgICAgICAgICB1cGRhdGVFeHByZXNzaW9uLnB1c2goXFxgXFwke2F0dHJOYW1lfSA9IFxcJHthdHRyVmFsdWV9XFxgKTtcbiAgICAgICAgICAgICAgICAgIGV4cHJlc3Npb25BdHRyaWJ1dGVOYW1lc1thdHRyTmFtZV0gPSBrZXk7XG4gICAgICAgICAgICAgICAgICBleHByZXNzaW9uQXR0cmlidXRlVmFsdWVzW2F0dHJWYWx1ZV0gPSB1cGRhdGVEYXRhW2tleV07XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZHluYW1vZGIuc2VuZChuZXcgVXBkYXRlQ29tbWFuZCh7XG4gICAgICAgICAgICAgICAgICBUYWJsZU5hbWU6IGxlYWRzVGFibGVOYW1lLFxuICAgICAgICAgICAgICAgICAgS2V5OiB7IGlkOiBwYXRoUGFyYW1ldGVycy5pZCB9LFxuICAgICAgICAgICAgICAgICAgVXBkYXRlRXhwcmVzc2lvbjogXFxgU0VUIFxcJHt1cGRhdGVFeHByZXNzaW9uLmpvaW4oJywgJyl9XFxgLFxuICAgICAgICAgICAgICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZU5hbWVzOiBleHByZXNzaW9uQXR0cmlidXRlTmFtZXMsXG4gICAgICAgICAgICAgICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiBleHByZXNzaW9uQXR0cmlidXRlVmFsdWVzLFxuICAgICAgICAgICAgICAgICAgUmV0dXJuVmFsdWVzOiAnQUxMX05FVydcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgICAgICAgICAgICAgIGhlYWRlcnM6IGNvcnNIZWFkZXJzLFxuICAgICAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocmVzdWx0LkF0dHJpYnV0ZXMpXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIGNhc2UgJ0RFTEVURSc6XG4gICAgICAgICAgICAgICAgaWYgKHBhdGhQYXJhbWV0ZXJzICYmIHBhdGhQYXJhbWV0ZXJzLmlkID09PSAncmVzZXQnKSB7XG4gICAgICAgICAgICAgICAgICAvLyBSZXNldC9jbGVhciBhbGwgbGVhZHMgKHNwZWNpYWwgZW5kcG9pbnQpXG4gICAgICAgICAgICAgICAgICBjb25zdCBzY2FuUmVzdWx0ID0gYXdhaXQgZHluYW1vZGIuc2VuZChuZXcgU2NhbkNvbW1hbmQoe1xuICAgICAgICAgICAgICAgICAgICBUYWJsZU5hbWU6IGxlYWRzVGFibGVOYW1lLFxuICAgICAgICAgICAgICAgICAgICBQcm9qZWN0aW9uRXhwcmVzc2lvbjogJ2lkJ1xuICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAvLyBEZWxldGUgYWxsIGl0ZW1zXG4gICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGl0ZW0gb2Ygc2NhblJlc3VsdC5JdGVtcyB8fCBbXSkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBkeW5hbW9kYi5zZW5kKG5ldyBEZWxldGVDb21tYW5kKHtcbiAgICAgICAgICAgICAgICAgICAgICBUYWJsZU5hbWU6IGxlYWRzVGFibGVOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgIEtleTogeyBpZDogaXRlbS5pZCB9XG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICAgICAgICAgICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycyxcbiAgICAgICAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBtZXNzYWdlOiBcXGBEZWxldGVkIFxcJHtzY2FuUmVzdWx0Lkl0ZW1zPy5sZW5ndGggfHwgMH0gbGVhZHNcXGAgfSlcbiAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChwYXRoUGFyYW1ldGVycyAmJiBwYXRoUGFyYW1ldGVycy5pZCkge1xuICAgICAgICAgICAgICAgICAgLy8gRGVsZXRlIHNpbmdsZSBsZWFkXG4gICAgICAgICAgICAgICAgICBhd2FpdCBkeW5hbW9kYi5zZW5kKG5ldyBEZWxldGVDb21tYW5kKHtcbiAgICAgICAgICAgICAgICAgICAgVGFibGVOYW1lOiBsZWFkc1RhYmxlTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgS2V5OiB7IGlkOiBwYXRoUGFyYW1ldGVycy5pZCB9XG4gICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwNCxcbiAgICAgICAgICAgICAgICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMsXG4gICAgICAgICAgICAgICAgICAgIGJvZHk6ICcnXG4gICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiA0MDAsXG4gICAgICAgICAgICAgICAgICAgIGhlYWRlcnM6IGNvcnNIZWFkZXJzLFxuICAgICAgICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnTGVhZCBJRCByZXF1aXJlZCcgfSlcbiAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogNDA1LFxuICAgICAgICAgICAgICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMsXG4gICAgICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnTWV0aG9kIG5vdCBhbGxvd2VkJyB9KVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDUwMCxcbiAgICAgICAgICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMsXG4gICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgXG4gICAgICAgICAgICAgICAgZXJyb3I6ICdJbnRlcm5hbCBzZXJ2ZXIgZXJyb3InLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGVycm9yLm1lc3NhZ2UgXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIGApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgTEVBRFNfVEFCTEVfTkFNRTogbGVhZHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEFDVElWSVRJRVNfVEFCTEVfTkFNRTogYWN0aXZpdGllc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgVVNFUl9QT09MX0lEOiB1c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgfSxcbiAgICB9KVxuXG4gICAgY29uc3QgYWN0aXZpdGllc0xhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgXCJBY3Rpdml0aWVzRnVuY3Rpb25cIiwge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiBcImluZGV4LmhhbmRsZXJcIixcbiAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgLy8gVXNlIEFXUyBTREsgdjMgaW5zdGVhZCBvZiBkZXByZWNhdGVkIGF3cy1zZGtcbiAgICAgICAgY29uc3QgeyBEeW5hbW9EQkNsaWVudCB9ID0gcmVxdWlyZSgnQGF3cy1zZGsvY2xpZW50LWR5bmFtb2RiJyk7XG4gICAgICAgIGNvbnN0IHsgRHluYW1vREJEb2N1bWVudENsaWVudCwgU2NhbkNvbW1hbmQsIFF1ZXJ5Q29tbWFuZCwgUHV0Q29tbWFuZCB9ID0gcmVxdWlyZSgnQGF3cy1zZGsvbGliLWR5bmFtb2RiJyk7XG4gICAgICAgIFxuICAgICAgICAvLyBJbml0aWFsaXplIER5bmFtb0RCIGNsaWVudCB3aXRoIHYzIFNES1xuICAgICAgICBjb25zdCBjbGllbnQgPSBuZXcgRHluYW1vREJDbGllbnQoe30pO1xuICAgICAgICBjb25zdCBkeW5hbW9kYiA9IER5bmFtb0RCRG9jdW1lbnRDbGllbnQuZnJvbShjbGllbnQpO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgY29yc0hlYWRlcnMgPSB7XG4gICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJyxcbiAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6ICdDb250ZW50LVR5cGUsQXV0aG9yaXphdGlvbicsXG4gICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiAnR0VULFBPU1QsUFVULERFTEVURSxPUFRJT05TJ1xuICAgICAgICB9O1xuICAgICAgICBcbiAgICAgICAgLy8gSGVscGVyIGZ1bmN0aW9uIHRvIGV4dHJhY3QgdXNlciBpbmZvIGZyb20gSldUIHRva2VuXG4gICAgICAgIGZ1bmN0aW9uIGdldFVzZXJGcm9tVG9rZW4oYXV0aEhlYWRlcikge1xuICAgICAgICAgIGlmICghYXV0aEhlYWRlciB8fCAhYXV0aEhlYWRlci5zdGFydHNXaXRoKCdCZWFyZXIgJykpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgdG9rZW4gPSBhdXRoSGVhZGVyLnN1YnN0cmluZyg3KTtcbiAgICAgICAgICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnBhcnNlKEJ1ZmZlci5mcm9tKHRva2VuLnNwbGl0KCcuJylbMV0sICdiYXNlNjQnKS50b1N0cmluZygpKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIGlkOiBwYXlsb2FkLnN1YixcbiAgICAgICAgICAgICAgZW1haWw6IHBheWxvYWQuZW1haWwsXG4gICAgICAgICAgICAgIG5hbWU6IHBheWxvYWQubmFtZSB8fCBwYXlsb2FkLmVtYWlsPy5zcGxpdCgnQCcpWzBdIHx8ICdVc2VyJ1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgcGFyc2luZyB0b2tlbjonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGV4cG9ydHMuaGFuZGxlciA9IGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdFdmVudDonLCBKU09OLnN0cmluZ2lmeShldmVudCwgbnVsbCwgMikpO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChldmVudC5odHRwTWV0aG9kID09PSAnT1BUSU9OUycpIHtcbiAgICAgICAgICAgIHJldHVybiB7IFxuICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsIFxuICAgICAgICAgICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycyxcbiAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBtZXNzYWdlOiAnQ09SUyBwcmVmbGlnaHQnIH0pXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBodHRwTWV0aG9kLCBxdWVyeVN0cmluZ1BhcmFtZXRlcnMsIGJvZHksIGhlYWRlcnMgfSA9IGV2ZW50O1xuICAgICAgICAgICAgY29uc3QgYWN0aXZpdGllc1RhYmxlTmFtZSA9IHByb2Nlc3MuZW52LkFDVElWSVRJRVNfVEFCTEVfTkFNRTtcbiAgICAgICAgICAgIGNvbnN0IHVzZXIgPSBnZXRVc2VyRnJvbVRva2VuKGhlYWRlcnMuQXV0aG9yaXphdGlvbiB8fCBoZWFkZXJzLmF1dGhvcml6YXRpb24pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBzd2l0Y2ggKGh0dHBNZXRob2QpIHtcbiAgICAgICAgICAgICAgY2FzZSAnR0VUJzpcbiAgICAgICAgICAgICAgICBpZiAocXVlcnlTdHJpbmdQYXJhbWV0ZXJzICYmIHF1ZXJ5U3RyaW5nUGFyYW1ldGVycy5sZWFkSWQpIHtcbiAgICAgICAgICAgICAgICAgIC8vIEdldCBhY3Rpdml0aWVzIGZvciBhIHNwZWNpZmljIGxlYWRcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGR5bmFtb2RiLnNlbmQobmV3IFF1ZXJ5Q29tbWFuZCh7XG4gICAgICAgICAgICAgICAgICAgIFRhYmxlTmFtZTogYWN0aXZpdGllc1RhYmxlTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgSW5kZXhOYW1lOiAnTGVhZElkSW5kZXgnLFxuICAgICAgICAgICAgICAgICAgICBLZXlDb25kaXRpb25FeHByZXNzaW9uOiAnbGVhZElkID0gOmxlYWRJZCcsXG4gICAgICAgICAgICAgICAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAnOmxlYWRJZCc6IHF1ZXJ5U3RyaW5nUGFyYW1ldGVycy5sZWFkSWRcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgU2NhbkluZGV4Rm9yd2FyZDogZmFsc2UgLy8gTW9zdCByZWNlbnQgZmlyc3RcbiAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICAgICAgICAgICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycyxcbiAgICAgICAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocmVzdWx0Lkl0ZW1zIHx8IFtdKVxuICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgLy8gR2V0IGFsbCBhY3Rpdml0aWVzXG4gICAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkeW5hbW9kYi5zZW5kKG5ldyBTY2FuQ29tbWFuZCh7XG4gICAgICAgICAgICAgICAgICAgIFRhYmxlTmFtZTogYWN0aXZpdGllc1RhYmxlTmFtZVxuICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgICAgICAgICAgIGhlYWRlcnM6IGNvcnNIZWFkZXJzLFxuICAgICAgICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShyZXN1bHQuSXRlbXMgfHwgW10pXG4gICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIGNhc2UgJ1BPU1QnOlxuICAgICAgICAgICAgICAgIGNvbnN0IG5ld0FjdGl2aXR5ID0gSlNPTi5wYXJzZShib2R5KTtcbiAgICAgICAgICAgICAgICBuZXdBY3Rpdml0eS5pZCA9IFxcYGFjdGl2aXR5X1xcJHtEYXRlLm5vdygpfV9cXCR7TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc3Vic3RyKDIsIDkpfVxcYDtcbiAgICAgICAgICAgICAgICBuZXdBY3Rpdml0eS50aW1lc3RhbXAgPSBEYXRlLm5vdygpO1xuICAgICAgICAgICAgICAgIG5ld0FjdGl2aXR5LmNyZWF0ZWRBdCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBBZGQgdXNlciBhdHRyaWJ1dGlvblxuICAgICAgICAgICAgICAgIGlmICh1c2VyKSB7XG4gICAgICAgICAgICAgICAgICBuZXdBY3Rpdml0eS5jcmVhdGVkQnkgPSB1c2VyLmlkO1xuICAgICAgICAgICAgICAgICAgbmV3QWN0aXZpdHkuY3JlYXRlZEJ5TmFtZSA9IHVzZXIubmFtZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgYXdhaXQgZHluYW1vZGIuc2VuZChuZXcgUHV0Q29tbWFuZCh7XG4gICAgICAgICAgICAgICAgICBUYWJsZU5hbWU6IGFjdGl2aXRpZXNUYWJsZU5hbWUsXG4gICAgICAgICAgICAgICAgICBJdGVtOiBuZXdBY3Rpdml0eVxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogMjAxLFxuICAgICAgICAgICAgICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMsXG4gICAgICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShuZXdBY3Rpdml0eSlcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogNDA1LFxuICAgICAgICAgICAgICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMsXG4gICAgICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnTWV0aG9kIG5vdCBhbGxvd2VkJyB9KVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDUwMCxcbiAgICAgICAgICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMsXG4gICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgXG4gICAgICAgICAgICAgICAgZXJyb3I6ICdJbnRlcm5hbCBzZXJ2ZXIgZXJyb3InLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGVycm9yLm1lc3NhZ2UgXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIGApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgTEVBRFNfVEFCTEVfTkFNRTogbGVhZHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEFDVElWSVRJRVNfVEFCTEVfTkFNRTogYWN0aXZpdGllc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgVVNFUl9QT09MX0lEOiB1c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgfSxcbiAgICB9KVxuXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnNcbiAgICBsZWFkc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShsZWFkc0xhbWJkYSlcbiAgICBhY3Rpdml0aWVzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGxlYWRzTGFtYmRhKVxuICAgIGFjdGl2aXRpZXNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoYWN0aXZpdGllc0xhbWJkYSlcblxuICAgIC8vIEFQSSBHYXRld2F5IHdpdGggQ29nbml0byBBdXRob3JpemVyXG4gICAgY29uc3QgYXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCBcIlNwYWNlcG9ydENybUFwaVwiLCB7XG4gICAgICByZXN0QXBpTmFtZTogXCJTcGFjZXBvcnQgQ1JNIEFQSVwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiQVBJIGZvciBTcGFjZXBvcnQgQ1JNIGFwcGxpY2F0aW9uXCIsXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBhcGlnYXRld2F5LkNvcnMuQUxMX09SSUdJTlMsXG4gICAgICAgIGFsbG93TWV0aG9kczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9NRVRIT0RTLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFtcIkNvbnRlbnQtVHlwZVwiLCBcIkF1dGhvcml6YXRpb25cIiwgXCJYLUFtei1EYXRlXCIsIFwiWC1BcGktS2V5XCIsIFwiWC1BbXotU2VjdXJpdHktVG9rZW5cIl0sXG4gICAgICB9LFxuICAgICAgZGVwbG95T3B0aW9uczoge1xuICAgICAgICBzdGFnZU5hbWU6IFwicHJvZFwiLFxuICAgICAgfSxcbiAgICB9KVxuXG4gICAgLy8gQ29nbml0byBBdXRob3JpemVyXG4gICAgY29uc3QgYXV0aG9yaXplciA9IG5ldyBhcGlnYXRld2F5LkNvZ25pdG9Vc2VyUG9vbHNBdXRob3JpemVyKHRoaXMsIFwiQ29nbml0b0F1dGhvcml6ZXJcIiwge1xuICAgICAgY29nbml0b1VzZXJQb29sczogW3VzZXJQb29sXSxcbiAgICAgIGlkZW50aXR5U291cmNlOiBcIm1ldGhvZC5yZXF1ZXN0LmhlYWRlci5BdXRob3JpemF0aW9uXCIsXG4gICAgfSlcblxuICAgIC8vIEFQSSBSZXNvdXJjZXNcbiAgICBjb25zdCBsZWFkc1Jlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoXCJsZWFkc1wiKVxuICAgIGNvbnN0IGxlYWRSZXNvdXJjZSA9IGxlYWRzUmVzb3VyY2UuYWRkUmVzb3VyY2UoXCJ7aWR9XCIpXG4gICAgY29uc3QgYWN0aXZpdGllc1Jlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoXCJhY3Rpdml0aWVzXCIpXG5cbiAgICAvLyBBUEkgTWV0aG9kcyB3aXRoIENvZ25pdG8gYXV0aG9yaXphdGlvblxuICAgIGNvbnN0IG1ldGhvZE9wdGlvbnMgPSB7XG4gICAgICBhdXRob3JpemVyLFxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcbiAgICAgIG1ldGhvZFJlc3BvbnNlczogW1xuICAgICAgICB7XG4gICAgICAgICAgc3RhdHVzQ29kZTogXCIyMDBcIixcbiAgICAgICAgICByZXNwb25zZUhlYWRlcnM6IHtcbiAgICAgICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luXCI6IHRydWUsXG4gICAgICAgICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnNcIjogdHJ1ZSxcbiAgICAgICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kc1wiOiB0cnVlLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBzdGF0dXNDb2RlOiBcIjQwMVwiLCBcbiAgICAgICAgICByZXNwb25zZUhlYWRlcnM6IHtcbiAgICAgICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luXCI6IHRydWUsXG4gICAgICAgICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnNcIjogdHJ1ZSxcbiAgICAgICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kc1wiOiB0cnVlLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBzdGF0dXNDb2RlOiBcIjQwM1wiLFxuICAgICAgICAgIHJlc3BvbnNlSGVhZGVyczoge1xuICAgICAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW5cIjogdHJ1ZSxcbiAgICAgICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVyc1wiOiB0cnVlLFxuICAgICAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzXCI6IHRydWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHN0YXR1c0NvZGU6IFwiNTAwXCIsXG4gICAgICAgICAgcmVzcG9uc2VIZWFkZXJzOiB7XG4gICAgICAgICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpblwiOiB0cnVlLFxuICAgICAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzXCI6IHRydWUsXG4gICAgICAgICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHNcIjogdHJ1ZSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9XG5cbiAgICBsZWFkc1Jlc291cmNlLmFkZE1ldGhvZChcIkdFVFwiLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihsZWFkc0xhbWJkYSksIG1ldGhvZE9wdGlvbnMpXG4gICAgbGVhZHNSZXNvdXJjZS5hZGRNZXRob2QoXCJQT1NUXCIsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGxlYWRzTGFtYmRhKSwgbWV0aG9kT3B0aW9ucylcbiAgICBsZWFkUmVzb3VyY2UuYWRkTWV0aG9kKFwiR0VUXCIsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGxlYWRzTGFtYmRhKSwgbWV0aG9kT3B0aW9ucylcbiAgICBsZWFkUmVzb3VyY2UuYWRkTWV0aG9kKFwiUFVUXCIsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGxlYWRzTGFtYmRhKSwgbWV0aG9kT3B0aW9ucylcbiAgICBsZWFkUmVzb3VyY2UuYWRkTWV0aG9kKFwiREVMRVRFXCIsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGxlYWRzTGFtYmRhKSwgbWV0aG9kT3B0aW9ucylcblxuICAgIGFjdGl2aXRpZXNSZXNvdXJjZS5hZGRNZXRob2QoXCJHRVRcIiwgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oYWN0aXZpdGllc0xhbWJkYSksIG1ldGhvZE9wdGlvbnMpXG4gICAgYWN0aXZpdGllc1Jlc291cmNlLmFkZE1ldGhvZChcIlBPU1RcIiwgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oYWN0aXZpdGllc0xhbWJkYSksIG1ldGhvZE9wdGlvbnMpXG5cbiAgICAvLyBBZGQgR2F0ZXdheSBSZXNwb25zZXMgZm9yIENPUlMgc3VwcG9ydCBvbiBhdXRoZW50aWNhdGlvbiBmYWlsdXJlc1xuICAgIGFwaS5hZGRHYXRld2F5UmVzcG9uc2UoXCJBdXRob3JpemVyRmFpbHVyZVwiLCB7XG4gICAgICB0eXBlOiBhcGlnYXRld2F5LlJlc3BvbnNlVHlwZS5VTkFVVEhPUklaRUQsXG4gICAgICByZXNwb25zZUhlYWRlcnM6IHtcbiAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW5cIjogXCInKidcIixcbiAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzXCI6IFwiJ0NvbnRlbnQtVHlwZSxBdXRob3JpemF0aW9uLFgtQW16LURhdGUsWC1BcGktS2V5LFgtQW16LVNlY3VyaXR5LVRva2VuJ1wiLFxuICAgICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHNcIjogXCInR0VULFBPU1QsUFVULERFTEVURSxPUFRJT05TJ1wiLFxuICAgICAgfSxcbiAgICB9KVxuXG4gICAgYXBpLmFkZEdhdGV3YXlSZXNwb25zZShcIkF1dGhvcml6ZXJDb25maWd1cmF0aW9uRXJyb3JcIiwge1xuICAgICAgdHlwZTogYXBpZ2F0ZXdheS5SZXNwb25zZVR5cGUuQVVUSE9SSVpFUl9DT05GSUdVUkFUSU9OX0VSUk9SLFxuICAgICAgcmVzcG9uc2VIZWFkZXJzOiB7XG4gICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luXCI6IFwiJyonXCIsXG4gICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVyc1wiOiBcIidDb250ZW50LVR5cGUsQXV0aG9yaXphdGlvbixYLUFtei1EYXRlLFgtQXBpLUtleSxYLUFtei1TZWN1cml0eS1Ub2tlbidcIixcbiAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzXCI6IFwiJ0dFVCxQT1NULFBVVCxERUxFVEUsT1BUSU9OUydcIixcbiAgICAgIH0sXG4gICAgfSlcblxuICAgIGFwaS5hZGRHYXRld2F5UmVzcG9uc2UoXCJBdXRob3JpemVyUmVzdWx0VHRsSW5TZWNvbmRzRmFpbHVyZVwiLCB7XG4gICAgICB0eXBlOiBhcGlnYXRld2F5LlJlc3BvbnNlVHlwZS5BVVRIT1JJWkVSX0ZBSUxVUkUsXG4gICAgICByZXNwb25zZUhlYWRlcnM6IHtcbiAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW5cIjogXCInKidcIixcbiAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzXCI6IFwiJ0NvbnRlbnQtVHlwZSxBdXRob3JpemF0aW9uLFgtQW16LURhdGUsWC1BcGktS2V5LFgtQW16LVNlY3VyaXR5LVRva2VuJ1wiLFxuICAgICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHNcIjogXCInR0VULFBPU1QsUFVULERFTEVURSxPUFRJT05TJ1wiLFxuICAgICAgfSxcbiAgICB9KVxuXG4gICAgYXBpLmFkZEdhdGV3YXlSZXNwb25zZShcIkFjY2Vzc0RlbmllZFwiLCB7XG4gICAgICB0eXBlOiBhcGlnYXRld2F5LlJlc3BvbnNlVHlwZS5BQ0NFU1NfREVOSUVELFxuICAgICAgcmVzcG9uc2VIZWFkZXJzOiB7XG4gICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luXCI6IFwiJyonXCIsXG4gICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVyc1wiOiBcIidDb250ZW50LVR5cGUsQXV0aG9yaXphdGlvbixYLUFtei1EYXRlLFgtQXBpLUtleSxYLUFtei1TZWN1cml0eS1Ub2tlbidcIixcbiAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzXCI6IFwiJ0dFVCxQT1NULFBVVCxERUxFVEUsT1BUSU9OUydcIixcbiAgICAgIH0sXG4gICAgfSlcblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIkFwaVVybFwiLCB7XG4gICAgICB2YWx1ZTogYXBpLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkFQSSBHYXRld2F5IFVSTFwiLFxuICAgICAgZXhwb3J0TmFtZTogXCJTcGFjZXBvcnRDcm1BcGlVcmxcIixcbiAgICB9KVxuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJVc2VyUG9vbElkXCIsIHtcbiAgICAgIHZhbHVlOiB1c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgZGVzY3JpcHRpb246IFwiQ29nbml0byBVc2VyIFBvb2wgSURcIixcbiAgICAgIGV4cG9ydE5hbWU6IFwiU3BhY2Vwb3J0Q3JtVXNlclBvb2xJZFwiLFxuICAgIH0pXG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlVzZXJQb29sQ2xpZW50SWRcIiwge1xuICAgICAgdmFsdWU6IHVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICBkZXNjcmlwdGlvbjogXCJDb2duaXRvIFVzZXIgUG9vbCBDbGllbnQgSURcIixcbiAgICAgIGV4cG9ydE5hbWU6IFwiU3BhY2Vwb3J0Q3JtVXNlclBvb2xDbGllbnRJZFwiLFxuICAgIH0pXG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlJlZ2lvblwiLCB7XG4gICAgICB2YWx1ZTogdGhpcy5yZWdpb24sXG4gICAgICBkZXNjcmlwdGlvbjogXCJBV1MgUmVnaW9uXCIsXG4gICAgICBleHBvcnROYW1lOiBcIlNwYWNlcG9ydENybVJlZ2lvblwiLFxuICAgIH0pXG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIkxlYWRzVGFibGVOYW1lXCIsIHtcbiAgICAgIHZhbHVlOiBsZWFkc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkR5bmFtb0RCIExlYWRzIFRhYmxlIE5hbWVcIixcbiAgICAgIGV4cG9ydE5hbWU6IFwiU3BhY2Vwb3J0Q3JtTGVhZHNUYWJsZVwiLFxuICAgIH0pXG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIkFjdGl2aXRpZXNUYWJsZU5hbWVcIiwge1xuICAgICAgdmFsdWU6IGFjdGl2aXRpZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogXCJEeW5hbW9EQiBBY3Rpdml0aWVzIFRhYmxlIE5hbWVcIixcbiAgICAgIGV4cG9ydE5hbWU6IFwiU3BhY2Vwb3J0Q3JtQWN0aXZpdGllc1RhYmxlXCIsXG4gICAgfSlcbiAgfVxufVxuIl19