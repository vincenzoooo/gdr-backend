FROM postgres:16-alpine
ENV POSTGRES_USER=${DB_USER}
ENV POSTGRES_PASSWORD=${DB_PASSWORD}
ENV POSTGRES_DB=${DB_NAME}
COPY ./init.sql /docker-entrypoint-initdb.d/
VOLUME /var/lib/postgresql/data