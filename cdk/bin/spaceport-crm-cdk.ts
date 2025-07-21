#!/usr/bin/env node
import "source-map-support/register"
import * as cdk from "aws-cdk-lib"
import { SpaceportCrmStack } from "../lib/spaceport-crm-stack"

const app = new cdk.App()

new SpaceportCrmStack(app, "SpaceportCrmStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || "975050048887",
    region: process.env.CDK_DEFAULT_REGION || "us-west-2",
  },
  description: "Spaceport CRM - Luxury CRM application with AWS backend",
})

app.synth()
