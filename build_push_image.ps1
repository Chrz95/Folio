docker buildx create --name folio-builder --use --buildkitd-config ./buildkitd.toml
docker buildx inspect --bootstrap
docker buildx build --platform linux/arm64 --target frontend -t 192.168.1.11:5000/folio-frontend:latest --push .
docker buildx build --platform linux/arm64 --target backend -t 192.168.1.11:5000/folio-backend:latest --push .
docker buildx build --platform linux/arm64 --target migrate -t 192.168.1.11:5000/folio-migrate:latest --push .
PAUSE