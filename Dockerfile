FROM docker.io/cloudflare/sandbox:0.12.9-python@sha256:f3c089b1bbb9dd85eeca09e20d841e6900390f45fb4e84dfbef0e9d17ddac806

USER root
RUN npm install --global typescript@7.0.2 tsx@4.23.13 \
    && npm cache clean --force

WORKDIR /workspace
