import { RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import {
  CfnSecurityGroupIngress,
  type IVpc,
  type SecurityGroup,
  SubnetType,
} from "aws-cdk-lib/aws-ec2";
import { Repository } from "aws-cdk-lib/aws-ecr";
import {
  Cluster,
  ContainerImage,
  Secret as EcsSecret,
} from "aws-cdk-lib/aws-ecs";
import { ApplicationLoadBalancedFargateService } from "aws-cdk-lib/aws-ecs-patterns";
import type { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";

interface ApiStackProps extends StackProps {
  vpc: IVpc;
  dbSecret: ISecret;
  dbSecurityGroup: SecurityGroup;
}

export class ApiStack extends Stack {
  public readonly repository: Repository;
  public readonly service: ApplicationLoadBalancedFargateService;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    this.repository = new Repository(this, "ApiRepo", {
      repositoryName: "mar-api",
      emptyOnDelete: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const cluster = new Cluster(this, "Cluster", { vpc: props.vpc });

    this.service = new ApplicationLoadBalancedFargateService(this, "Service", {
      cluster,
      cpu: 256,
      memoryLimitMiB: 512,
      desiredCount: 1,
      publicLoadBalancer: true,
      taskSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      taskImageOptions: {
        image: ContainerImage.fromRegistry(
          "public.ecr.aws/docker/library/nginx:latest"
        ),
        containerPort: 80,
        secrets: {
          DB_HOST: EcsSecret.fromSecretsManager(props.dbSecret, "host"),
          DB_PORT: EcsSecret.fromSecretsManager(props.dbSecret, "port"),
          DB_NAME: EcsSecret.fromSecretsManager(props.dbSecret, "dbname"),
          DB_USER: EcsSecret.fromSecretsManager(props.dbSecret, "username"),
          DB_PASSWORD: EcsSecret.fromSecretsManager(props.dbSecret, "password"),
        },
      },
    });

    new CfnSecurityGroupIngress(this, "DbIngress", {
      groupId: props.dbSecurityGroup.securityGroupId,
      sourceSecurityGroupId:
        this.service.service.connections.securityGroups[0].securityGroupId,
      ipProtocol: "tcp",
      fromPort: 5432,
      toPort: 5432,
      description: "App task → RDS PostgreSQL",
    });
  }
}
