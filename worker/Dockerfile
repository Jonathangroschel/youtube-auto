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
    && pip3 install --break-system-packages yt-dlp \
    && pip3 install --break-system-packages opencv-python-headless==4.8.1.78 mediapipe==0.10.14 numpy \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files from worker directory
COPY worker/package*.json ./

# Install dependencies
RUN npm install --production

# Copy source from worker directory
COPY worker/server.js ./

# Copy Python crop script
COPY scripts/autoclip/crop.py ./scripts/crop.py

# Create temp directory
RUN mkdir -p /tmp/autoclip

EXPOSE 3001

CMD ["node", "server.js"]
