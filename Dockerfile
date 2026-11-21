FROM node:22-bookworm-slim AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend .
RUN npm run build

FROM python:3.13-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 UVICORN_HOST=0.0.0.0
COPY backend/requirements.txt /tmp/cosmos-requirements.txt
RUN pip install --no-cache-dir -r /tmp/cosmos-requirements.txt
COPY backend backend
COPY scripts scripts
COPY data data
COPY --from=frontend /build/dist frontend/dist
RUN useradd --no-create-home --uid 10001 cosmos
USER cosmos
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "backend.app.main:app"]
