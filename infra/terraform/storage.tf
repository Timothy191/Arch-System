resource "aws_s3_bucket" "assets" {
  bucket = "${var.project}-assets"
  tags   = { Name = "${var.project}-assets" }
}
resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration { status = "Enabled" }
}