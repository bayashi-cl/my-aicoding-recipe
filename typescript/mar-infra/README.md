# mar-infra

AWS CDK (TypeScript) スタック定義。設計は [`docs/design.md` §5](../../docs/design.md) を参照。

## スコープ

- `cdk synth` が通ることが完了条件 (M5)。
- **`cdk deploy` は禁止** ([CLAUDE.md](../../CLAUDE.md) 「絶対にやらないこと」参照)。

## スタック構成

| Stack | 構成 |
|-------|------|
| `MarNetworkStack`  | VPC (max-AZ 2 / NAT 1 / public + private-egress + isolated) |
| `MarDatabaseStack` | RDS PostgreSQL 16 (Single-AZ, t4g.micro, Secrets Manager 自動生成) |
| `MarApiStack`      | ECS Fargate + ALB + ECR。API イメージは **プレースホルダ (`public.ecr.aws/docker/library/nginx`, port 80)** |
| `MarWebStack`      | S3 (BlockPublicAccess.ALL) + CloudFront (OAC) |

## コマンド

```bash
# 全スタック synth (cdk.out/ に CloudFormation テンプレ生成)
pnpm --filter mar-infra exec cdk synth --quiet

# 個別 synth
pnpm --filter mar-infra exec cdk synth MarNetworkStack
```

`cdk synth` は **AWS 認証情報も Docker も不要**。Dev Container 内でそのまま実行できる。

## PoC 用の妥協メモ

- NAT Gateway は 1 個 (HA でない)。実運用なら AZ ごとに NAT を置く。
- API コンテナイメージは `public.ecr.aws/docker/library/nginx` のプレースホルダで `containerPort: 80`。実 API は 8000。差し替え時に `ContainerImage.fromEcrRepository(repo, "latest")` と `containerPort: 8000` に変更する。
- RDS の `removalPolicy: DESTROY` と S3 の `autoDeleteObjects: true` は PoC 用。実 deploy 前に必ず見直す。
