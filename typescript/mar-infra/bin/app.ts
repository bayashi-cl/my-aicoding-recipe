#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { ApiStack } from "../lib/api-stack";
import { DatabaseStack } from "../lib/database-stack";
import { NetworkStack } from "../lib/network-stack";
import { WebStack } from "../lib/web-stack";

const app = new App();

const network = new NetworkStack(app, "MarNetworkStack");

const database = new DatabaseStack(app, "MarDatabaseStack", {
  vpc: network.vpc,
});

new ApiStack(app, "MarApiStack", {
  vpc: network.vpc,
  dbSecret: database.secret,
  dbSecurityGroup: database.securityGroup,
});

new WebStack(app, "MarWebStack");
