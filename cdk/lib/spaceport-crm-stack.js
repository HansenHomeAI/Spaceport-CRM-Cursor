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
                newLead.lastInteraction = newLead.lastInteraction || new Date().toISOString();
                newLead.nextActionDate = newLead.nextActionDate || new Date().toISOString();
                newLead.priority = newLead.priority || 'medium';
                newLead.status = newLead.status || 'contacted';
                newLead.needsAttention = newLead.needsAttention || false;
                
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
                
                // Check if this is a reset request
                if (pathParameters.id === 'reset') {
                  // Delete all leads
                  const scanResult = await dynamodb.scan({
                    TableName: leadsTableName
                  }).promise();
                  
                  if (scanResult.Items && scanResult.Items.length > 0) {
                    const deletePromises = scanResult.Items.map(item => 
                      dynamodb.delete({
                        TableName: leadsTableName,
                        Key: { id: item.id }
                      }).promise()
                    );
                    
                    await Promise.all(deletePromises);
                  }
                  
                  return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ message: 'Database reset successfully' })
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
        });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3BhY2Vwb3J0LWNybS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNwYWNlcG9ydC1jcm0tc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQWtDO0FBQ2xDLHFEQUFvRDtBQUNwRCxpREFBZ0Q7QUFDaEQseURBQXdEO0FBQ3hELG1EQUFrRDtBQUNsRCwyQ0FBMEM7QUFHMUMsTUFBYSxpQkFBa0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQUM5QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzlELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFBO1FBRXZCLGtCQUFrQjtRQUNsQixNQUFNLFVBQVUsR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUN4RCxTQUFTLEVBQUUscUJBQXFCO1lBQ2hDLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ2pFLFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTTtZQUN2QyxtQkFBbUIsRUFBRSxJQUFJO1NBQzFCLENBQUMsQ0FBQTtRQUVGLE1BQU0sZUFBZSxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFDbEUsU0FBUyxFQUFFLDBCQUEwQjtZQUNyQyxZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUNqRSxPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUNuRSxXQUFXLEVBQUUs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SSxFQUFFLGdCQUFnQixFQUFFO1lBQ3hDLEtBQUssRUFBRSxVQUFVLENBQUMsU0FBUztZQUMzQixXQUFXLEVBQUUsMkJBQTJCO1lBQ3hDLFVBQVUsRUFBRSx3QkFBd0I7U0FDckMsQ0FBQyxDQUFBO1FBRUYsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUM3QyxLQUFLLEVBQUUsZUFBZSxDQUFDLFNBQVM7WUFDaEMsV0FBVyxFQUFFLGdDQUFnQztZQUM3QyxVQUFVLEVBQUUsNkJBQTZCO1NBQzFDLENBQUMsQ0FBQTtJQUNKLENBQUM7Q0FDRjtBQWhqQkQsOENBZ2pCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tIFwiYXdzLWNkay1saWJcIlxuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSBcImF3cy1jZGstbGliL2F3cy1keW5hbW9kYlwiXG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSBcImF3cy1jZGstbGliL2F3cy1sYW1iZGFcIlxuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXlcIlxuaW1wb3J0ICogYXMgY29nbml0byBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWNvZ25pdG9cIlxuaW1wb3J0ICogYXMgaWFtIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtaWFtXCJcbmltcG9ydCB0eXBlIHsgQ29uc3RydWN0IH0gZnJvbSBcImNvbnN0cnVjdHNcIlxuXG5leHBvcnQgY2xhc3MgU3BhY2Vwb3J0Q3JtU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcylcblxuICAgIC8vIER5bmFtb0RCIFRhYmxlc1xuICAgIGNvbnN0IGxlYWRzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgXCJMZWFkc1RhYmxlXCIsIHtcbiAgICAgIHRhYmxlTmFtZTogXCJzcGFjZXBvcnQtY3JtLWxlYWRzXCIsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogXCJpZFwiLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IHRydWUsXG4gICAgfSlcblxuICAgIGNvbnN0IGFjdGl2aXRpZXNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCBcIkFjdGl2aXRpZXNUYWJsZVwiLCB7XG4gICAgICB0YWJsZU5hbWU6IFwic3BhY2Vwb3J0LWNybS1hY3Rpdml0aWVzXCIsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogXCJpZFwiLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiBcInRpbWVzdGFtcFwiLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLk5VTUJFUiB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IHRydWUsXG4gICAgfSlcblxuICAgIC8vIEFkZCBHU0kgZm9yIHF1ZXJ5aW5nIGFjdGl2aXRpZXMgYnkgbGVhZCBJRFxuICAgIGFjdGl2aXRpZXNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6IFwiTGVhZElkSW5kZXhcIixcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiBcImxlYWRJZFwiLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiBcInRpbWVzdGFtcFwiLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLk5VTUJFUiB9LFxuICAgIH0pXG5cbiAgICAvLyBDb2duaXRvIFVzZXIgUG9vbFxuICAgIGNvbnN0IHVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgXCJTcGFjZXBvcnRDcm1Vc2VyUG9vbFwiLCB7XG4gICAgICB1c2VyUG9vbE5hbWU6IFwic3BhY2Vwb3J0LWNybS11c2Vyc1wiLFxuICAgICAgc2VsZlNpZ25VcEVuYWJsZWQ6IHRydWUsXG4gICAgICBzaWduSW5BbGlhc2VzOiB7IGVtYWlsOiB0cnVlIH0sXG4gICAgICBhdXRvVmVyaWZ5OiB7IGVtYWlsOiB0cnVlIH0sXG4gICAgICBzdGFuZGFyZEF0dHJpYnV0ZXM6IHtcbiAgICAgICAgZW1haWw6IHsgcmVxdWlyZWQ6IHRydWUsIG11dGFibGU6IHRydWUgfSxcbiAgICAgICAgZ2l2ZW5OYW1lOiB7IHJlcXVpcmVkOiB0cnVlLCBtdXRhYmxlOiB0cnVlIH0sXG4gICAgICAgIGZhbWlseU5hbWU6IHsgcmVxdWlyZWQ6IHRydWUsIG11dGFibGU6IHRydWUgfSxcbiAgICAgIH0sXG4gICAgICBwYXNzd29yZFBvbGljeToge1xuICAgICAgICBtaW5MZW5ndGg6IDgsXG4gICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVEaWdpdHM6IHRydWUsXG4gICAgICAgIHJlcXVpcmVTeW1ib2xzOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBhY2NvdW50UmVjb3Zlcnk6IGNvZ25pdG8uQWNjb3VudFJlY292ZXJ5LkVNQUlMX09OTFksXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgfSlcblxuICAgIGNvbnN0IHVzZXJQb29sQ2xpZW50ID0gbmV3IGNvZ25pdG8uVXNlclBvb2xDbGllbnQodGhpcywgXCJTcGFjZXBvcnRDcm1Vc2VyUG9vbENsaWVudFwiLCB7XG4gICAgICB1c2VyUG9vbCxcbiAgICAgIGdlbmVyYXRlU2VjcmV0OiBmYWxzZSxcbiAgICAgIGF1dGhGbG93czoge1xuICAgICAgICBhZG1pblVzZXJQYXNzd29yZDogdHJ1ZSxcbiAgICAgICAgY3VzdG9tOiB0cnVlLFxuICAgICAgICB1c2VyU3JwOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIG9BdXRoOiB7XG4gICAgICAgIGZsb3dzOiB7IGF1dGhvcml6YXRpb25Db2RlR3JhbnQ6IHRydWUgfSxcbiAgICAgICAgc2NvcGVzOiBbY29nbml0by5PQXV0aFNjb3BlLkVNQUlMLCBjb2duaXRvLk9BdXRoU2NvcGUuT1BFTklELCBjb2duaXRvLk9BdXRoU2NvcGUuUFJPRklMRV0sXG4gICAgICB9LFxuICAgIH0pXG5cbiAgICAvLyBMYW1iZGEgZXhlY3V0aW9uIHJvbGVcbiAgICBjb25zdCBsYW1iZGFSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsIFwiTGFtYmRhRXhlY3V0aW9uUm9sZVwiLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbChcImxhbWJkYS5hbWF6b25hd3MuY29tXCIpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKFwic2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZVwiKV0sXG4gICAgfSlcblxuICAgIC8vIExhbWJkYSBGdW5jdGlvbnMgd2l0aCBlbmhhbmNlZCB1c2VyIGF0dHJpYnV0aW9uXG4gICAgY29uc3QgbGVhZHNMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIFwiTGVhZHNGdW5jdGlvblwiLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6IFwiaW5kZXguaGFuZGxlclwiLFxuICAgICAgcm9sZTogbGFtYmRhUm9sZSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuICAgICAgICBjb25zdCBBV1MgPSByZXF1aXJlKCdhd3Mtc2RrJyk7XG4gICAgICAgIGNvbnN0IGR5bmFtb2RiID0gbmV3IEFXUy5EeW5hbW9EQi5Eb2N1bWVudENsaWVudCgpO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgY29yc0hlYWRlcnMgPSB7XG4gICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJyxcbiAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6ICdDb250ZW50LVR5cGUsQXV0aG9yaXphdGlvbicsXG4gICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiAnR0VULFBPU1QsUFVULERFTEVURSxPUFRJT05TJ1xuICAgICAgICB9O1xuICAgICAgICBcbiAgICAgICAgLy8gSGVscGVyIGZ1bmN0aW9uIHRvIGV4dHJhY3QgdXNlciBpbmZvIGZyb20gSldUIHRva2VuXG4gICAgICAgIGZ1bmN0aW9uIGdldFVzZXJGcm9tVG9rZW4oYXV0aEhlYWRlcikge1xuICAgICAgICAgIGlmICghYXV0aEhlYWRlciB8fCAhYXV0aEhlYWRlci5zdGFydHNXaXRoKCdCZWFyZXIgJykpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgdG9rZW4gPSBhdXRoSGVhZGVyLnN1YnN0cmluZyg3KTtcbiAgICAgICAgICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnBhcnNlKEJ1ZmZlci5mcm9tKHRva2VuLnNwbGl0KCcuJylbMV0sICdiYXNlNjQnKS50b1N0cmluZygpKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIGlkOiBwYXlsb2FkLnN1YixcbiAgICAgICAgICAgICAgZW1haWw6IHBheWxvYWQuZW1haWwsXG4gICAgICAgICAgICAgIG5hbWU6IHBheWxvYWQubmFtZSB8fCBwYXlsb2FkLmVtYWlsPy5zcGxpdCgnQCcpWzBdIHx8ICdVc2VyJ1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgcGFyc2luZyB0b2tlbjonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGV4cG9ydHMuaGFuZGxlciA9IGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdFdmVudDonLCBKU09OLnN0cmluZ2lmeShldmVudCwgbnVsbCwgMikpO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChldmVudC5odHRwTWV0aG9kID09PSAnT1BUSU9OUycpIHtcbiAgICAgICAgICAgIHJldHVybiB7IFxuICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsIFxuICAgICAgICAgICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycyxcbiAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBtZXNzYWdlOiAnQ09SUyBwcmVmbGlnaHQnIH0pXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBodHRwTWV0aG9kLCBwYXRoUGFyYW1ldGVycywgYm9keSwgaGVhZGVycyB9ID0gZXZlbnQ7XG4gICAgICAgICAgICBjb25zdCBsZWFkc1RhYmxlTmFtZSA9IHByb2Nlc3MuZW52LkxFQURTX1RBQkxFX05BTUU7XG4gICAgICAgICAgICBjb25zdCB1c2VyID0gZ2V0VXNlckZyb21Ub2tlbihoZWFkZXJzLkF1dGhvcml6YXRpb24gfHwgaGVhZGVycy5hdXRob3JpemF0aW9uKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgc3dpdGNoIChodHRwTWV0aG9kKSB7XG4gICAgICAgICAgICAgIGNhc2UgJ0dFVCc6XG4gICAgICAgICAgICAgICAgaWYgKHBhdGhQYXJhbWV0ZXJzICYmIHBhdGhQYXJhbWV0ZXJzLmlkKSB7XG4gICAgICAgICAgICAgICAgICAvLyBHZXQgc2luZ2xlIGxlYWRcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGR5bmFtb2RiLmdldCh7XG4gICAgICAgICAgICAgICAgICAgIFRhYmxlTmFtZTogbGVhZHNUYWJsZU5hbWUsXG4gICAgICAgICAgICAgICAgICAgIEtleTogeyBpZDogcGF0aFBhcmFtZXRlcnMuaWQgfVxuICAgICAgICAgICAgICAgICAgfSkucHJvbWlzZSgpO1xuICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgICAgICAgICAgIGhlYWRlcnM6IGNvcnNIZWFkZXJzLFxuICAgICAgICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShyZXN1bHQuSXRlbSB8fCBudWxsKVxuICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgLy8gR2V0IGFsbCBsZWFkc1xuICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZHluYW1vZGIuc2Nhbih7XG4gICAgICAgICAgICAgICAgICAgIFRhYmxlTmFtZTogbGVhZHNUYWJsZU5hbWVcbiAgICAgICAgICAgICAgICAgIH0pLnByb21pc2UoKTtcbiAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICAgICAgICAgICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycyxcbiAgICAgICAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocmVzdWx0Lkl0ZW1zIHx8IFtdKVxuICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICBjYXNlICdQT1NUJzpcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdMZWFkID0gSlNPTi5wYXJzZShib2R5KTtcbiAgICAgICAgICAgICAgICBuZXdMZWFkLmlkID0gXFxgbGVhZF9cXCR7RGF0ZS5ub3coKX1fXFwke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cigyLCA5KX1cXGA7XG4gICAgICAgICAgICAgICAgbmV3TGVhZC5jcmVhdGVkQXQgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgbmV3TGVhZC51cGRhdGVkQXQgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgbmV3TGVhZC5ub3RlcyA9IG5ld0xlYWQubm90ZXMgfHwgW107XG4gICAgICAgICAgICAgICAgbmV3TGVhZC5sYXN0SW50ZXJhY3Rpb24gPSBuZXdMZWFkLmxhc3RJbnRlcmFjdGlvbiB8fCBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgbmV3TGVhZC5uZXh0QWN0aW9uRGF0ZSA9IG5ld0xlYWQubmV4dEFjdGlvbkRhdGUgfHwgbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICAgICAgICAgICAgICAgIG5ld0xlYWQucHJpb3JpdHkgPSBuZXdMZWFkLnByaW9yaXR5IHx8ICdtZWRpdW0nO1xuICAgICAgICAgICAgICAgIG5ld0xlYWQuc3RhdHVzID0gbmV3TGVhZC5zdGF0dXMgfHwgJ2NvbnRhY3RlZCc7XG4gICAgICAgICAgICAgICAgbmV3TGVhZC5uZWVkc0F0dGVudGlvbiA9IG5ld0xlYWQubmVlZHNBdHRlbnRpb24gfHwgZmFsc2U7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gQWRkIHVzZXIgYXR0cmlidXRpb25cbiAgICAgICAgICAgICAgICBpZiAodXNlcikge1xuICAgICAgICAgICAgICAgICAgbmV3TGVhZC5jcmVhdGVkQnkgPSB1c2VyLmlkO1xuICAgICAgICAgICAgICAgICAgbmV3TGVhZC5jcmVhdGVkQnlOYW1lID0gdXNlci5uYW1lO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBhd2FpdCBkeW5hbW9kYi5wdXQoe1xuICAgICAgICAgICAgICAgICAgVGFibGVOYW1lOiBsZWFkc1RhYmxlTmFtZSxcbiAgICAgICAgICAgICAgICAgIEl0ZW06IG5ld0xlYWRcbiAgICAgICAgICAgICAgICB9KS5wcm9taXNlKCk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMSxcbiAgICAgICAgICAgICAgICAgIGhlYWRlcnM6IGNvcnNIZWFkZXJzLFxuICAgICAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkobmV3TGVhZClcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgY2FzZSAnUFVUJzpcbiAgICAgICAgICAgICAgICBjb25zdCB1cGRhdGVkTGVhZCA9IEpTT04ucGFyc2UoYm9keSk7XG4gICAgICAgICAgICAgICAgdXBkYXRlZExlYWQudXBkYXRlZEF0ID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIEFkZCB1c2VyIGF0dHJpYnV0aW9uIGZvciB1cGRhdGVzXG4gICAgICAgICAgICAgICAgaWYgKHVzZXIpIHtcbiAgICAgICAgICAgICAgICAgIHVwZGF0ZWRMZWFkLmxhc3RVcGRhdGVkQnkgPSB1c2VyLmlkO1xuICAgICAgICAgICAgICAgICAgdXBkYXRlZExlYWQubGFzdFVwZGF0ZWRCeU5hbWUgPSB1c2VyLm5hbWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGF3YWl0IGR5bmFtb2RiLnB1dCh7XG4gICAgICAgICAgICAgICAgICBUYWJsZU5hbWU6IGxlYWRzVGFibGVOYW1lLFxuICAgICAgICAgICAgICAgICAgSXRlbTogdXBkYXRlZExlYWRcbiAgICAgICAgICAgICAgICB9KS5wcm9taXNlKCk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgICAgICAgICAgICAgIGhlYWRlcnM6IGNvcnNIZWFkZXJzLFxuICAgICAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkodXBkYXRlZExlYWQpXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIGNhc2UgJ0RFTEVURSc6XG4gICAgICAgICAgICAgICAgaWYgKCFwYXRoUGFyYW1ldGVycyB8fCAhcGF0aFBhcmFtZXRlcnMuaWQpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDQwMCxcbiAgICAgICAgICAgICAgICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMsXG4gICAgICAgICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdMZWFkIElEIGlzIHJlcXVpcmVkJyB9KVxuICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gQ2hlY2sgaWYgdGhpcyBpcyBhIHJlc2V0IHJlcXVlc3RcbiAgICAgICAgICAgICAgICBpZiAocGF0aFBhcmFtZXRlcnMuaWQgPT09ICdyZXNldCcpIHtcbiAgICAgICAgICAgICAgICAgIC8vIERlbGV0ZSBhbGwgbGVhZHNcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHNjYW5SZXN1bHQgPSBhd2FpdCBkeW5hbW9kYi5zY2FuKHtcbiAgICAgICAgICAgICAgICAgICAgVGFibGVOYW1lOiBsZWFkc1RhYmxlTmFtZVxuICAgICAgICAgICAgICAgICAgfSkucHJvbWlzZSgpO1xuICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICBpZiAoc2NhblJlc3VsdC5JdGVtcyAmJiBzY2FuUmVzdWx0Lkl0ZW1zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGVsZXRlUHJvbWlzZXMgPSBzY2FuUmVzdWx0Lkl0ZW1zLm1hcChpdGVtID0+IFxuICAgICAgICAgICAgICAgICAgICAgIGR5bmFtb2RiLmRlbGV0ZSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBUYWJsZU5hbWU6IGxlYWRzVGFibGVOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgS2V5OiB7IGlkOiBpdGVtLmlkIH1cbiAgICAgICAgICAgICAgICAgICAgICB9KS5wcm9taXNlKClcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IFByb21pc2UuYWxsKGRlbGV0ZVByb21pc2VzKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICAgICAgICAgICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycyxcbiAgICAgICAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBtZXNzYWdlOiAnRGF0YWJhc2UgcmVzZXQgc3VjY2Vzc2Z1bGx5JyB9KVxuICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgYXdhaXQgZHluYW1vZGIuZGVsZXRlKHtcbiAgICAgICAgICAgICAgICAgIFRhYmxlTmFtZTogbGVhZHNUYWJsZU5hbWUsXG4gICAgICAgICAgICAgICAgICBLZXk6IHsgaWQ6IHBhdGhQYXJhbWV0ZXJzLmlkIH1cbiAgICAgICAgICAgICAgICB9KS5wcm9taXNlKCk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwNCxcbiAgICAgICAgICAgICAgICAgIGhlYWRlcnM6IGNvcnNIZWFkZXJzLFxuICAgICAgICAgICAgICAgICAgYm9keTogJydcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogNDA1LFxuICAgICAgICAgICAgICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMsXG4gICAgICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnTWV0aG9kIG5vdCBhbGxvd2VkJyB9KVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDUwMCxcbiAgICAgICAgICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMsXG4gICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgXG4gICAgICAgICAgICAgICAgZXJyb3I6ICdJbnRlcm5hbCBzZXJ2ZXIgZXJyb3InLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGVycm9yLm1lc3NhZ2UgXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIGApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgTEVBRFNfVEFCTEVfTkFNRTogbGVhZHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEFDVElWSVRJRVNfVEFCTEVfTkFNRTogYWN0aXZpdGllc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgVVNFUl9QT09MX0lEOiB1c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgfSxcbiAgICB9KVxuXG4gICAgY29uc3QgYWN0aXZpdGllc0xhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgXCJBY3Rpdml0aWVzRnVuY3Rpb25cIiwge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiBcImluZGV4LmhhbmRsZXJcIixcbiAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgY29uc3QgQVdTID0gcmVxdWlyZSgnYXdzLXNkaycpO1xuICAgICAgICBjb25zdCBkeW5hbW9kYiA9IG5ldyBBV1MuRHluYW1vREIuRG9jdW1lbnRDbGllbnQoKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNvcnNIZWFkZXJzID0ge1xuICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXG4gICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiAnQ29udGVudC1UeXBlLEF1dGhvcml6YXRpb24nLFxuICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogJ0dFVCxQT1NULFBVVCxERUxFVEUsT1BUSU9OUydcbiAgICAgICAgfTtcbiAgICAgICAgXG4gICAgICAgIC8vIEhlbHBlciBmdW5jdGlvbiB0byBleHRyYWN0IHVzZXIgaW5mbyBmcm9tIEpXVCB0b2tlblxuICAgICAgICBmdW5jdGlvbiBnZXRVc2VyRnJvbVRva2VuKGF1dGhIZWFkZXIpIHtcbiAgICAgICAgICBpZiAoIWF1dGhIZWFkZXIgfHwgIWF1dGhIZWFkZXIuc3RhcnRzV2l0aCgnQmVhcmVyICcpKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHRva2VuID0gYXV0aEhlYWRlci5zdWJzdHJpbmcoNyk7XG4gICAgICAgICAgICBjb25zdCBwYXlsb2FkID0gSlNPTi5wYXJzZShCdWZmZXIuZnJvbSh0b2tlbi5zcGxpdCgnLicpWzFdLCAnYmFzZTY0JykudG9TdHJpbmcoKSk7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBpZDogcGF5bG9hZC5zdWIsXG4gICAgICAgICAgICAgIGVtYWlsOiBwYXlsb2FkLmVtYWlsLFxuICAgICAgICAgICAgICBuYW1lOiBwYXlsb2FkLm5hbWUgfHwgcGF5bG9hZC5lbWFpbD8uc3BsaXQoJ0AnKVswXSB8fCAnVXNlcidcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHBhcnNpbmcgdG9rZW46JywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBleHBvcnRzLmhhbmRsZXIgPSBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnRXZlbnQ6JywgSlNPTi5zdHJpbmdpZnkoZXZlbnQsIG51bGwsIDIpKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoZXZlbnQuaHR0cE1ldGhvZCA9PT0gJ09QVElPTlMnKSB7XG4gICAgICAgICAgICByZXR1cm4geyBcbiAgICAgICAgICAgICAgc3RhdHVzQ29kZTogMjAwLCBcbiAgICAgICAgICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMsXG4gICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgbWVzc2FnZTogJ0NPUlMgcHJlZmxpZ2h0JyB9KVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgaHR0cE1ldGhvZCwgcXVlcnlTdHJpbmdQYXJhbWV0ZXJzLCBib2R5LCBoZWFkZXJzIH0gPSBldmVudDtcbiAgICAgICAgICAgIGNvbnN0IGFjdGl2aXRpZXNUYWJsZU5hbWUgPSBwcm9jZXNzLmVudi5BQ1RJVklUSUVTX1RBQkxFX05BTUU7XG4gICAgICAgICAgICBjb25zdCB1c2VyID0gZ2V0VXNlckZyb21Ub2tlbihoZWFkZXJzLkF1dGhvcml6YXRpb24gfHwgaGVhZGVycy5hdXRob3JpemF0aW9uKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgc3dpdGNoIChodHRwTWV0aG9kKSB7XG4gICAgICAgICAgICAgIGNhc2UgJ0dFVCc6XG4gICAgICAgICAgICAgICAgaWYgKHF1ZXJ5U3RyaW5nUGFyYW1ldGVycyAmJiBxdWVyeVN0cmluZ1BhcmFtZXRlcnMubGVhZElkKSB7XG4gICAgICAgICAgICAgICAgICAvLyBHZXQgYWN0aXZpdGllcyBmb3IgYSBzcGVjaWZpYyBsZWFkXG4gICAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkeW5hbW9kYi5xdWVyeSh7XG4gICAgICAgICAgICAgICAgICAgIFRhYmxlTmFtZTogYWN0aXZpdGllc1RhYmxlTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgSW5kZXhOYW1lOiAnTGVhZElkSW5kZXgnLFxuICAgICAgICAgICAgICAgICAgICBLZXlDb25kaXRpb25FeHByZXNzaW9uOiAnbGVhZElkID0gOmxlYWRJZCcsXG4gICAgICAgICAgICAgICAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAnOmxlYWRJZCc6IHF1ZXJ5U3RyaW5nUGFyYW1ldGVycy5sZWFkSWRcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgU2NhbkluZGV4Rm9yd2FyZDogZmFsc2UgLy8gTW9zdCByZWNlbnQgZmlyc3RcbiAgICAgICAgICAgICAgICAgIH0pLnByb21pc2UoKTtcbiAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICAgICAgICAgICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycyxcbiAgICAgICAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocmVzdWx0Lkl0ZW1zIHx8IFtdKVxuICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgLy8gR2V0IGFsbCBhY3Rpdml0aWVzXG4gICAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkeW5hbW9kYi5zY2FuKHtcbiAgICAgICAgICAgICAgICAgICAgVGFibGVOYW1lOiBhY3Rpdml0aWVzVGFibGVOYW1lXG4gICAgICAgICAgICAgICAgICB9KS5wcm9taXNlKCk7XG4gICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgICAgICAgICAgICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMsXG4gICAgICAgICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlc3VsdC5JdGVtcyB8fCBbXSlcbiAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgY2FzZSAnUE9TVCc6XG4gICAgICAgICAgICAgICAgY29uc3QgbmV3QWN0aXZpdHkgPSBKU09OLnBhcnNlKGJvZHkpO1xuICAgICAgICAgICAgICAgIG5ld0FjdGl2aXR5LmlkID0gXFxgYWN0aXZpdHlfXFwke0RhdGUubm93KCl9X1xcJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHIoMiwgOSl9XFxgO1xuICAgICAgICAgICAgICAgIG5ld0FjdGl2aXR5LnRpbWVzdGFtcCA9IERhdGUubm93KCk7XG4gICAgICAgICAgICAgICAgbmV3QWN0aXZpdHkuY3JlYXRlZEF0ID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIEFkZCB1c2VyIGF0dHJpYnV0aW9uXG4gICAgICAgICAgICAgICAgaWYgKHVzZXIpIHtcbiAgICAgICAgICAgICAgICAgIG5ld0FjdGl2aXR5LmNyZWF0ZWRCeSA9IHVzZXIuaWQ7XG4gICAgICAgICAgICAgICAgICBuZXdBY3Rpdml0eS5jcmVhdGVkQnlOYW1lID0gdXNlci5uYW1lO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBhd2FpdCBkeW5hbW9kYi5wdXQoe1xuICAgICAgICAgICAgICAgICAgVGFibGVOYW1lOiBhY3Rpdml0aWVzVGFibGVOYW1lLFxuICAgICAgICAgICAgICAgICAgSXRlbTogbmV3QWN0aXZpdHlcbiAgICAgICAgICAgICAgICB9KS5wcm9taXNlKCk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMSxcbiAgICAgICAgICAgICAgICAgIGhlYWRlcnM6IGNvcnNIZWFkZXJzLFxuICAgICAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkobmV3QWN0aXZpdHkpXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDQwNSxcbiAgICAgICAgICAgICAgICAgIGhlYWRlcnM6IGNvcnNIZWFkZXJzLFxuICAgICAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ01ldGhvZCBub3QgYWxsb3dlZCcgfSlcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvcjonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBzdGF0dXNDb2RlOiA1MDAsXG4gICAgICAgICAgICAgIGhlYWRlcnM6IGNvcnNIZWFkZXJzLFxuICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IFxuICAgICAgICAgICAgICAgIGVycm9yOiAnSW50ZXJuYWwgc2VydmVyIGVycm9yJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBlcnJvci5tZXNzYWdlIFxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICBgKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIExFQURTX1RBQkxFX05BTUU6IGxlYWRzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBBQ1RJVklUSUVTX1RBQkxFX05BTUU6IGFjdGl2aXRpZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFVTRVJfUE9PTF9JRDogdXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgIH0sXG4gICAgfSlcblxuICAgIC8vIEdyYW50IHBlcm1pc3Npb25zXG4gICAgbGVhZHNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEobGVhZHNMYW1iZGEpXG4gICAgYWN0aXZpdGllc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShsZWFkc0xhbWJkYSlcbiAgICBhY3Rpdml0aWVzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGFjdGl2aXRpZXNMYW1iZGEpXG5cbiAgICAvLyBBUEkgR2F0ZXdheSB3aXRoIENvZ25pdG8gQXV0aG9yaXplclxuICAgIGNvbnN0IGFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgXCJTcGFjZXBvcnRDcm1BcGlcIiwge1xuICAgICAgcmVzdEFwaU5hbWU6IFwiU3BhY2Vwb3J0IENSTSBBUElcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkFQSSBmb3IgU3BhY2Vwb3J0IENSTSBhcHBsaWNhdGlvblwiLFxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XG4gICAgICAgIGFsbG93T3JpZ2luczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9PUklHSU5TLFxuICAgICAgICBhbGxvd01ldGhvZHM6IGFwaWdhdGV3YXkuQ29ycy5BTExfTUVUSE9EUyxcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbXCJDb250ZW50LVR5cGVcIiwgXCJBdXRob3JpemF0aW9uXCIsIFwiWC1BbXotRGF0ZVwiLCBcIlgtQXBpLUtleVwiLCBcIlgtQW16LVNlY3VyaXR5LVRva2VuXCJdLFxuICAgICAgfSxcbiAgICAgIGRlcGxveU9wdGlvbnM6IHtcbiAgICAgICAgc3RhZ2VOYW1lOiBcInByb2RcIixcbiAgICAgIH0sXG4gICAgfSlcblxuICAgIC8vIENvZ25pdG8gQXV0aG9yaXplclxuICAgIGNvbnN0IGF1dGhvcml6ZXIgPSBuZXcgYXBpZ2F0ZXdheS5Db2duaXRvVXNlclBvb2xzQXV0aG9yaXplcih0aGlzLCBcIkNvZ25pdG9BdXRob3JpemVyXCIsIHtcbiAgICAgIGNvZ25pdG9Vc2VyUG9vbHM6IFt1c2VyUG9vbF0sXG4gICAgICBpZGVudGl0eVNvdXJjZTogXCJtZXRob2QucmVxdWVzdC5oZWFkZXIuQXV0aG9yaXphdGlvblwiLFxuICAgIH0pXG5cbiAgICAvLyBBUEkgUmVzb3VyY2VzXG4gICAgY29uc3QgbGVhZHNSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKFwibGVhZHNcIilcbiAgICBjb25zdCBsZWFkUmVzb3VyY2UgPSBsZWFkc1Jlc291cmNlLmFkZFJlc291cmNlKFwie2lkfVwiKVxuICAgIGNvbnN0IGFjdGl2aXRpZXNSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKFwiYWN0aXZpdGllc1wiKVxuXG4gICAgLy8gQVBJIE1ldGhvZHMgd2l0aCBDb2duaXRvIGF1dGhvcml6YXRpb25cbiAgICBjb25zdCBtZXRob2RPcHRpb25zID0ge1xuICAgICAgYXV0aG9yaXplcixcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICBtZXRob2RSZXNwb25zZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIHN0YXR1c0NvZGU6IFwiMjAwXCIsXG4gICAgICAgICAgcmVzcG9uc2VIZWFkZXJzOiB7XG4gICAgICAgICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpblwiOiB0cnVlLFxuICAgICAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzXCI6IHRydWUsXG4gICAgICAgICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHNcIjogdHJ1ZSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgc3RhdHVzQ29kZTogXCI0MDFcIiwgXG4gICAgICAgICAgcmVzcG9uc2VIZWFkZXJzOiB7XG4gICAgICAgICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpblwiOiB0cnVlLFxuICAgICAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzXCI6IHRydWUsXG4gICAgICAgICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHNcIjogdHJ1ZSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgc3RhdHVzQ29kZTogXCI0MDNcIixcbiAgICAgICAgICByZXNwb25zZUhlYWRlcnM6IHtcbiAgICAgICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luXCI6IHRydWUsXG4gICAgICAgICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnNcIjogdHJ1ZSxcbiAgICAgICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kc1wiOiB0cnVlLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBzdGF0dXNDb2RlOiBcIjUwMFwiLFxuICAgICAgICAgIHJlc3BvbnNlSGVhZGVyczoge1xuICAgICAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW5cIjogdHJ1ZSxcbiAgICAgICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVyc1wiOiB0cnVlLFxuICAgICAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzXCI6IHRydWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfVxuXG4gICAgbGVhZHNSZXNvdXJjZS5hZGRNZXRob2QoXCJHRVRcIiwgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24obGVhZHNMYW1iZGEpLCBtZXRob2RPcHRpb25zKVxuICAgIGxlYWRzUmVzb3VyY2UuYWRkTWV0aG9kKFwiUE9TVFwiLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihsZWFkc0xhbWJkYSksIG1ldGhvZE9wdGlvbnMpXG4gICAgbGVhZFJlc291cmNlLmFkZE1ldGhvZChcIkdFVFwiLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihsZWFkc0xhbWJkYSksIG1ldGhvZE9wdGlvbnMpXG4gICAgbGVhZFJlc291cmNlLmFkZE1ldGhvZChcIlBVVFwiLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihsZWFkc0xhbWJkYSksIG1ldGhvZE9wdGlvbnMpXG4gICAgbGVhZFJlc291cmNlLmFkZE1ldGhvZChcIkRFTEVURVwiLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihsZWFkc0xhbWJkYSksIG1ldGhvZE9wdGlvbnMpXG5cbiAgICBhY3Rpdml0aWVzUmVzb3VyY2UuYWRkTWV0aG9kKFwiR0VUXCIsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGFjdGl2aXRpZXNMYW1iZGEpLCBtZXRob2RPcHRpb25zKVxuICAgIGFjdGl2aXRpZXNSZXNvdXJjZS5hZGRNZXRob2QoXCJQT1NUXCIsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGFjdGl2aXRpZXNMYW1iZGEpLCBtZXRob2RPcHRpb25zKVxuXG4gICAgLy8gQWRkIEdhdGV3YXkgUmVzcG9uc2VzIGZvciBDT1JTIHN1cHBvcnQgb24gYXV0aGVudGljYXRpb24gZmFpbHVyZXNcbiAgICBhcGkuYWRkR2F0ZXdheVJlc3BvbnNlKFwiQXV0aG9yaXplckZhaWx1cmVcIiwge1xuICAgICAgdHlwZTogYXBpZ2F0ZXdheS5SZXNwb25zZVR5cGUuVU5BVVRIT1JJWkVELFxuICAgICAgcmVzcG9uc2VIZWFkZXJzOiB7XG4gICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luXCI6IFwiJyonXCIsXG4gICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVyc1wiOiBcIidDb250ZW50LVR5cGUsQXV0aG9yaXphdGlvbixYLUFtei1EYXRlLFgtQXBpLUtleSxYLUFtei1TZWN1cml0eS1Ub2tlbidcIixcbiAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzXCI6IFwiJ0dFVCxQT1NULFBVVCxERUxFVEUsT1BUSU9OUydcIixcbiAgICAgIH0sXG4gICAgfSlcblxuICAgIGFwaS5hZGRHYXRld2F5UmVzcG9uc2UoXCJBdXRob3JpemVyQ29uZmlndXJhdGlvbkVycm9yXCIsIHtcbiAgICAgIHR5cGU6IGFwaWdhdGV3YXkuUmVzcG9uc2VUeXBlLkFVVEhPUklaRVJfQ09ORklHVVJBVElPTl9FUlJPUixcbiAgICAgIHJlc3BvbnNlSGVhZGVyczoge1xuICAgICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpblwiOiBcIicqJ1wiLFxuICAgICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnNcIjogXCInQ29udGVudC1UeXBlLEF1dGhvcml6YXRpb24sWC1BbXotRGF0ZSxYLUFwaS1LZXksWC1BbXotU2VjdXJpdHktVG9rZW4nXCIsXG4gICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kc1wiOiBcIidHRVQsUE9TVCxQVVQsREVMRVRFLE9QVElPTlMnXCIsXG4gICAgICB9LFxuICAgIH0pXG5cbiAgICBhcGkuYWRkR2F0ZXdheVJlc3BvbnNlKFwiQXV0aG9yaXplclJlc3VsdFR0bEluU2Vjb25kc0ZhaWx1cmVcIiwge1xuICAgICAgdHlwZTogYXBpZ2F0ZXdheS5SZXNwb25zZVR5cGUuQVVUSE9SSVpFUl9GQUlMVVJFLFxuICAgICAgcmVzcG9uc2VIZWFkZXJzOiB7XG4gICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luXCI6IFwiJyonXCIsXG4gICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVyc1wiOiBcIidDb250ZW50LVR5cGUsQXV0aG9yaXphdGlvbixYLUFtei1EYXRlLFgtQXBpLUtleSxYLUFtei1TZWN1cml0eS1Ub2tlbidcIixcbiAgICAgICAgXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzXCI6IFwiJ0dFVCxQT1NULFBVVCxERUxFVEUsT1BUSU9OUydcIixcbiAgICAgIH0sXG4gICAgfSlcblxuICAgIGFwaS5hZGRHYXRld2F5UmVzcG9uc2UoXCJBY2Nlc3NEZW5pZWRcIiwge1xuICAgICAgdHlwZTogYXBpZ2F0ZXdheS5SZXNwb25zZVR5cGUuQUNDRVNTX0RFTklFRCxcbiAgICAgIHJlc3BvbnNlSGVhZGVyczoge1xuICAgICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpblwiOiBcIicqJ1wiLFxuICAgICAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnNcIjogXCInQ29udGVudC1UeXBlLEF1dGhvcml6YXRpb24sWC1BbXotRGF0ZSxYLUFwaS1LZXksWC1BbXotU2VjdXJpdHktVG9rZW4nXCIsXG4gICAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kc1wiOiBcIidHRVQsUE9TVCxQVVQsREVMRVRFLE9QVElPTlMnXCIsXG4gICAgICB9LFxuICAgIH0pXG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJBcGlVcmxcIiwge1xuICAgICAgdmFsdWU6IGFwaS51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogXCJBUEkgR2F0ZXdheSBVUkxcIixcbiAgICAgIGV4cG9ydE5hbWU6IFwiU3BhY2Vwb3J0Q3JtQXBpVXJsXCIsXG4gICAgfSlcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiVXNlclBvb2xJZFwiLCB7XG4gICAgICB2YWx1ZTogdXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkNvZ25pdG8gVXNlciBQb29sIElEXCIsXG4gICAgICBleHBvcnROYW1lOiBcIlNwYWNlcG9ydENybVVzZXJQb29sSWRcIixcbiAgICB9KVxuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJVc2VyUG9vbENsaWVudElkXCIsIHtcbiAgICAgIHZhbHVlOiB1c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgICAgZGVzY3JpcHRpb246IFwiQ29nbml0byBVc2VyIFBvb2wgQ2xpZW50IElEXCIsXG4gICAgICBleHBvcnROYW1lOiBcIlNwYWNlcG9ydENybVVzZXJQb29sQ2xpZW50SWRcIixcbiAgICB9KVxuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJSZWdpb25cIiwge1xuICAgICAgdmFsdWU6IHRoaXMucmVnaW9uLFxuICAgICAgZGVzY3JpcHRpb246IFwiQVdTIFJlZ2lvblwiLFxuICAgICAgZXhwb3J0TmFtZTogXCJTcGFjZXBvcnRDcm1SZWdpb25cIixcbiAgICB9KVxuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJMZWFkc1RhYmxlTmFtZVwiLCB7XG4gICAgICB2YWx1ZTogbGVhZHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogXCJEeW5hbW9EQiBMZWFkcyBUYWJsZSBOYW1lXCIsXG4gICAgICBleHBvcnROYW1lOiBcIlNwYWNlcG9ydENybUxlYWRzVGFibGVcIixcbiAgICB9KVxuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJBY3Rpdml0aWVzVGFibGVOYW1lXCIsIHtcbiAgICAgIHZhbHVlOiBhY3Rpdml0aWVzVGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246IFwiRHluYW1vREIgQWN0aXZpdGllcyBUYWJsZSBOYW1lXCIsXG4gICAgICBleHBvcnROYW1lOiBcIlNwYWNlcG9ydENybUFjdGl2aXRpZXNUYWJsZVwiLFxuICAgIH0pXG4gIH1cbn1cbiJdfQ==