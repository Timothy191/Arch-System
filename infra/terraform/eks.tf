resource "aws_eks_cluster" "main" {
  name     = "${var.project}-eks"
  role_arn = aws_iam_role.eks_cluster.arn
  vpc_config {
    subnet_ids = aws_subnet.public[*].id
  }
}
resource "aws_iam_role" "eks_cluster" {
  name = "${var.project}-eks-cluster-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "eks.amazonaws.com" }
    }]
  })
}