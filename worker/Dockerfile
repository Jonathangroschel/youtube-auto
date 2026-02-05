FROM node:20-slim

# Install FFmpeg, Python, and dependencies for face detection
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libxkbcommon0 \
    libasound2 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libcups2 \
    libdrm2 \
    libxfixes3 \
    libxi6 \
    libxtst6 \
    libgtk-3-0 \
    libxshmfence1 \
    libxcursor1 \
    fonts-noto-core \
    fonts-noto-color-emoji \
    fonts-dejavu-core \
    fonts-liberation \
    fontconfig \
    && pip3 install --break-system-packages yt-dlp \
    && pip3 install --break-system-packages opencv-python-headless==4.8.1.78 mediapipe==0.10.14 numpy \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files from worker directory
COPY worker/package*.json ./

# Install dependencies
RUN npm install --production

# Install Playwright Chromium
RUN npx playwright install chromium

# Copy source from worker directory
COPY worker/server.js ./
COPY worker/transcription-manager.js ./

# Copy Python crop script
COPY scripts/autoclip/crop.py ./scripts/crop.py

# Create temp directory
RUN mkdir -p /tmp/autoclip

EXPOSE 3001

CMD ["node", "server.js"]
