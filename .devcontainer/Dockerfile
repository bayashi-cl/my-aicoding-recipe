FROM mcr.microsoft.com/devcontainers/base:bookworm

# rootless Docker ではコンテナの root がホストのユーザにマップされる。
# UID 不整合（bind mount したワークスペースが root 所有に見える問題）を避けるため、
# 意図的にコンテナ内も root で動かす。
USER root

RUN curl -fsSL https://mise.run | sh \
 && echo 'eval "$(~/.local/bin/mise activate bash)"' >> ~/.bashrc \
 && echo 'eval "$(~/.local/bin/mise activate zsh)"' >> ~/.zshrc

ENV PATH="/root/.local/bin:/root/.local/share/mise/shims:${PATH}"
