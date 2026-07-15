FROM python:3.12-slim

WORKDIR /app
COPY . .

RUN pip install --no-cache-dir -e .

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://127.0.0.1:55423/health || exit 1

ENTRYPOINT ["tokdash", "serve", "--no-open"]
