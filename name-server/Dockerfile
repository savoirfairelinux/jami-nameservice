FROM rust as planner
WORKDIR jami-name-server
# We only pay the installation cost once,
# it will be cached from the second build onwards
# To ensure a reproducible build consider pinning
# the cargo-chef version with `--version X.X.X`
RUN cargo install cargo-chef
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM rust as cacher
WORKDIR jami-name-server
RUN cargo install cargo-chef
COPY --from=planner /jami-name-server/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json

FROM rust as builder
WORKDIR jami-name-server
COPY . .
# Copy over the cached dependencies
COPY --from=cacher /jami-name-server/target target
COPY --from=cacher /usr/local/cargo /usr/local/cargo
RUN cargo build --release --bin jami-name-server

FROM rust as runtime
WORKDIR jami-name-server
COPY --from=builder /jami-name-server/target/release/jami-name-server /usr/local/bin
COPY ./entrypoint /entrypoint
EXPOSE 80
ENTRYPOINT ["/entrypoint"]
