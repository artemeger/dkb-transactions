FROM node:20-bullseye

# Install Wine for Windows builds
RUN dpkg --add-architecture i386 && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
    wine32 \
    wine64 \
    cabextract \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Create symlinks so electron-builder finds wine
RUN ln -sf /usr/bin/wine64-stable /usr/bin/wine && \
    ln -sf /usr/bin/wine64-stable /usr/bin/wine64

# Create home dir writable by any UID
RUN mkdir -p /home/node && chmod 777 /home/node

# Set Wine environment
ENV WINEARCH=win64
ENV WINEDLLOVERRIDES="winemenubuilder.exe=d"
ENV HOME=/home/node
ENV DISPLAY=:99

WORKDIR /app
