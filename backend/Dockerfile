FROM python:3.11-slim

# Install system deps for PostGIS client, Tesseract OCR, build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    tesseract-ocr \
    tesseract-ocr-hin \
    fonts-deva \
    libtesseract-dev \
    libleptonica-dev \
    libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
