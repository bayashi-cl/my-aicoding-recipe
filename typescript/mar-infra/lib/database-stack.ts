import { Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import {
  InstanceClass,
  InstanceSize,
  InstanceType,
  type IVpc,
  SecurityGroup,
  SubnetType,
} from "aws-cdk-lib/aws-ec2";
import {
  Credentials,
  DatabaseInstance,
  DatabaseInstanceEngine,
  PostgresEngineVersion,
} from "aws-cdk-lib/aws-rds";
import type { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";

interface DatabaseStackProps extends StackProps {
  vpc: IVpc;
}

export class DatabaseStack extends Stack {
  public readonly instance: DatabaseInstance;
  public readonly secret: ISecret;
  public readonly securityGroup: SecurityGroup;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    this.securityGroup = new SecurityGroup(this, "DbSg", {
      vpc: props.vpc,
      description: "RDS PostgreSQL ingress controlled by app SG",
      allowAllOutbound: false,
    });

    this.instance = new DatabaseInstance(this, "Postgres", {
      engine: DatabaseInstanceEngine.postgres({
        version: PostgresEngineVersion.VER_16_4,
      }),
      vpc: props.vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
      instanceType: InstanceType.of(InstanceClass.T4G, InstanceSize.MICRO),
      multiAz: false,
      allocatedStorage: 20,
      maxAllocatedStorage: 50,
      databaseName: "notes",
      credentials: Credentials.fromGeneratedSecret("app"),
      securityGroups: [this.securityGroup],
      backupRetention: Duration.days(1),
      deleteAutomatedBackups: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const generated = this.instance.secret;
    if (!generated) {
      throw new Error(
        "Expected RDS to auto-generate a secret via Credentials.fromGeneratedSecret"
      );
    }
    this.secret = generated;
  }
}
