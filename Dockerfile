FROM php:8.2-apache

# 1. Sasisha mfumo na usakinishe Node.js, SQLite, na zana zinazohitajika
RUN apt-get update && apt-get install -y \
    curl \
    sqlite3 \
    libsqlite3-dev \
    && curl -sL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && docker-php-ext-install pdo pdo_sqlite

# 2. Weka saraka ya kazi kwenye folda ya Apache
WORKDIR /var/www/html

# 3. Nakili mafaili yote ya mradi wako ndani ya kontena
COPY . /var/www/html/

# 4. Weka ruhusa kamili za kuandika kwa ajili ya SQLite na Apache
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 777 /var/www/html

# 5. Sakinisha vifurushi vya Node.js (kama package.json ipo)
RUN if [ -f package.json ]; then npm install; fi

EXPOSE 7860

# 6. Amri ya kuendesha Node.js pekee (kuondoa mgongano wa EADDRINUSE na Apache)
CMD ["node", "index.js"]
